<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Models\Promotion;
use App\Models\PromotionPackage;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Services\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Platform side of paid visibility: payments to review, live / scheduled
 * promotions (end one), packages and slot limits (Platform Owner), and
 * granting a promotion to a shop.
 */
class PromotionController extends Controller
{
    public function __construct(private PromotionService $promotions) {}

    public function stats(): JsonResponse
    {
        $pending = Promotion::where('status', Promotion::STATUS_PENDING);
        $month = Promotion::where('status', Promotion::STATUS_APPROVED)->where('kind', Promotion::KIND_PAID)->where('reviewed_at', '>=', now()->startOfMonth());

        return response()->json(['data' => [
            'pending' => ['count' => (clone $pending)->count(), 'amount' => (float) (clone $pending)->sum('amount')],
            'this_month' => ['count' => (clone $month)->count(), 'amount' => (float) (clone $month)->sum('amount')],
            'live' => [
                'featured' => Promotion::live()->where('type', Promotion::TYPE_FEATURED)->count(),
                'sponsored' => Promotion::live()->where('type', Promotion::TYPE_SPONSORED)->count(),
            ],
            'scheduled' => Promotion::where('status', Promotion::STATUS_APPROVED)->where('starts_at', '>', now())->count(),
            'slots' => ['featured' => $this->promotions->featuredSlots(), 'sponsored' => $this->promotions->sponsoredSlots()],
        ]]);
    }

    /** ServerDataTable list. ?status=pending|live|scheduled|ended|rejected, ?type=featured|sponsored. */
    public function index(Request $request): JsonResponse
    {
        $now = now();
        $rows = Promotion::with(['shop:id,name', 'package:id,name', 'vehicle:id,title', 'submitter:id,name', 'reviewer:id,name', 'proof'])
            ->when($request->type, fn ($q) => $q->where('type', $request->type))
            ->when($request->status, fn ($q) => match ($request->status) {
                'pending', 'rejected' => $q->where('status', $request->status),
                'live' => $q->live(),
                'scheduled' => $q->where('status', Promotion::STATUS_APPROVED)->where('starts_at', '>', $now),
                'ended' => $q->where('status', Promotion::STATUS_APPROVED)->where('ends_at', '<=', $now),
                default => $q,
            })
            ->when($request->search, fn ($q) => $q->where(fn ($w) => $w
                ->where('reference_no', 'like', "%{$request->search}%")
                ->orWhere('bank_reference', 'like', "%{$request->search}%")
                ->orWhereHas('shop', fn ($s) => $s->where('name', 'like', "%{$request->search}%"))))
            ->orderByRaw("status = 'pending' desc")->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        $rows->getCollection()->transform(fn (Promotion $p) => $this->promotions->present($p) + [
            'shop' => $p->shop?->only(['id', 'name']), 'submitter' => $p->submitter?->name, 'reviewer' => $p->reviewer?->name,
        ]);

        return response()->json(['record' => $rows, 'message' => 'Promotions retrieved', 'status' => true]);
    }

    public function approve(Promotion $promotion): JsonResponse
    {
        $promotion = $this->promotions->approve($this->admin(), $promotion);

        return response()->json([
            'message' => $promotion->starts_at->isFuture() ? 'Approved — slots are full, it starts ' . $promotion->starts_at->toDayDateTimeString() : 'Approved — live now',
            'data' => $this->promotions->present($promotion),
        ]);
    }

    public function reject(Request $request, Promotion $promotion): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'max:255']])['reason'];

        return response()->json(['message' => 'Payment rejected', 'data' => $this->promotions->present($this->promotions->reject($this->admin(), $promotion, $reason))]);
    }

    public function end(Request $request, Promotion $promotion): JsonResponse
    {
        $reason = $request->validate(['reason' => ['nullable', 'string', 'max:255']])['reason'] ?? null;

        return response()->json(['message' => 'Promotion ended', 'data' => $this->promotions->present($this->promotions->end($this->admin(), $promotion, $reason))]);
    }

    public function proof(Promotion $promotion): StreamedResponse
    {
        abort_unless($promotion->proof, 404);

        return Storage::disk($promotion->proof->disk)->response($promotion->proof->file_path, $promotion->proof->file_name);
    }

    /** Give a shop a featured vehicle or a city sponsorship for N days (respects slot limits — may be scheduled). */
    public function grant(Request $request, RentalShop $rentalShop): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in([Promotion::TYPE_FEATURED, Promotion::TYPE_SPONSORED])],
            'vehicle_id' => ['nullable', 'integer'], // featured; sponsored always uses the shop's city
            'days' => ['required', 'integer', 'min:1', 'max:365'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $promotion = $this->promotions->grant($this->admin(), $rentalShop, $data['type'], $data, (int) $data['days'], $data['note'] ?? null);

        return response()->json([
            'message' => $promotion->starts_at->isFuture() ? 'Granted — starts ' . $promotion->starts_at->toDayDateTimeString() : 'Granted — live now',
            'data' => $this->promotions->present($promotion),
        ], 201);
    }

    // ── Packages & settings (Platform Owner edits) ─────────────────────────

    public function packages(): JsonResponse
    {
        return response()->json(['data' => [
            'packages' => PromotionPackage::orderBy('type')->orderBy('sort_order')->get(),
            'settings' => ['featured_listing_slots' => $this->promotions->featuredSlots(), 'sponsored_slots_per_target' => $this->promotions->sponsoredSlots()],
        ]]);
    }

    public function storePackage(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Package created', 'data' => PromotionPackage::create($this->validatePackage($request))], 201);
    }

    public function updatePackage(Request $request, PromotionPackage $package): JsonResponse
    {
        $package->update($this->validatePackage($request));

        return response()->json(['message' => 'Package saved', 'data' => $package->fresh()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'featured_listing_slots' => ['required', 'integer', 'min:1', 'max:500'],
            'sponsored_slots_per_target' => ['required', 'integer', 'min:1', 'max:50'],
        ]);
        foreach ($data as $key => $value) {
            PlatformSetting::updateOrCreate(['key' => $key], ['value' => ['value' => $value], 'group' => 'promotions', 'updated_by' => $this->admin()->id]);
        }

        return $this->packages();
    }

    private function validatePackage(Request $request): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in([Promotion::TYPE_FEATURED, Promotion::TYPE_SPONSORED])],
            'name' => ['required', 'string', 'max:80'],
            'days' => ['required', 'integer', 'min:1', 'max:365'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['sort_order'] ??= 0;

        return $data;
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
