<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Models\PromotionPackage;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\PromotionService;
use App\Services\SubscriptionService;
use App\Support\VendorContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Buying visibility for the shop — featured vehicles and city sponsorship
 * (PromotionService). Shop owner only (vendor-promotions-*).
 */
class PromotionController extends Controller
{
    public function __construct(private PromotionService $promotions)
    {
        $this->middleware('can:vendor-promotions-view')->only(['index', 'availability', 'proof']);
        $this->middleware('can:vendor-promotions-create')->only('pay');
    }

    /** Packages, the shop's vehicles and city, the platform bank account, and the shop's promotions. */
    public function index(): JsonResponse
    {
        $shop = RentalShop::findOrFail(VendorContext::shopId());

        $vehicles = Vehicle::where('status', Vehicle::STATUS_PUBLISHED)->where('moderation_status', Vehicle::MODERATION_APPROVED)
            ->orderBy('title')->get(['id', 'title']);

        return response()->json(['data' => [
            'packages' => PromotionPackage::where('is_active', true)->orderBy('sort_order')->get(['id', 'type', 'name', 'days', 'price']),
            'vehicles' => $vehicles->map(fn (Vehicle $v) => ['id' => $v->id, 'title' => $v->title, 'is_featured' => $v->is_featured])->values(),
            'city' => $shop->city,
            'slots' => ['featured' => $this->promotions->featuredSlots(), 'sponsored' => $this->promotions->sponsoredSlots()],
            'bank' => app(SubscriptionService::class)->bankDetails(),
            'promotions' => Promotion::with(['package:id,name', 'vehicle:id,title', 'proof'])
                ->where('shop_id', $shop->id)->latest()->limit(100)->get()
                ->map(fn (Promotion $p) => $this->promotions->present($p))->values(),
        ]]);
    }

    /** When a package for this vehicle (or the shop's city) would start if approved now (slots may be full). */
    public function availability(Request $request): JsonResponse
    {
        $data = $this->validateTarget($request);
        $shop = RentalShop::findOrFail(VendorContext::shopId());
        $package = PromotionPackage::findOrFail($data['package_id']);
        $target = $this->promotions->resolveTarget($shop, $package->type, $data);
        $start = $this->promotions->nextStart($package->type, $target + ['shop_id' => $shop->id], $package->days);

        return response()->json(['data' => [
            'starts_at' => $start->toIso8601String(),
            'ends_at' => $start->copy()->addDays($package->days)->toIso8601String(),
            'starts_now' => !$start->isAfter(now()->addMinute()),
        ]]);
    }

    public function pay(Request $request): JsonResponse
    {
        $data = $this->validateTarget($request) + $request->validate([
            'bank_reference' => ['nullable', 'string', 'max:120'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        $promotion = $this->promotions->submit(
            RentalShop::findOrFail(VendorContext::shopId()), AuthUser::user(),
            PromotionPackage::findOrFail($data['package_id']), $data, $data['bank_reference'] ?? null, $request->file('proof'),
        );

        AuditService::create('Promotion', $promotion->id, $promotion->reference_no, [
            'package_id' => $promotion->package_id, 'bank_reference' => $data['bank_reference'] ?? null, 'status' => $promotion->status,
        ]);

        return response()->json([
            'message' => 'Payment sent — the platform will confirm it shortly',
            'data' => $this->promotions->present($promotion->load(['package:id,name', 'vehicle:id,title'])),
        ], 201);
    }

    public function proof(Promotion $promotion): StreamedResponse
    {
        abort_unless($promotion->shop_id === VendorContext::shopId() && $promotion->proof, 404);

        return Storage::disk($promotion->proof->disk)->response($promotion->proof->file_path, $promotion->proof->file_name);
    }

    private function validateTarget(Request $request): array
    {
        return $request->validate([
            'package_id' => ['required', 'integer', Rule::exists('promotion_packages', 'id')->where('is_active', true)],
            'vehicle_id' => ['nullable', 'integer'], // featured; sponsored always uses the shop's city
        ]);
    }
}
