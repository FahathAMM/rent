<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Booking;
use App\Models\RentalShop;
use App\Models\ShopVerification;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Services\AuditService;
use App\Services\ShopOnboardingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ShopVerificationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ShopOnboardingService $service) {}

    public function index(Request $request): JsonResponse
    {
        $shops = RentalShop::with('owner:id,name,email')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->verification_status, fn ($q) => $q->where('verification_status', $request->verification_status))
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $shops, 'message' => 'Shops retrieved', 'status' => true]);
    }

    public function show(RentalShop $rentalShop): JsonResponse
    {
        $rentalShop->load(
            'owner:id,name,email,phone,created_at',
            'verifications.attachment',
            'members:id,shop_id,name,email,status',
            'locations:id,shop_id,name,type,address,city,district,is_active',
        )->loadCount([
            'vehicles',
            'vehicles as published_vehicles_count' => fn ($q) => $q->where('status', Vehicle::STATUS_PUBLISHED),
            'bookings',
            'bookings as open_bookings_count' => fn ($q) => $q->whereIn('status', [
                Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE,
            ]),
        ]);

        // The detail page's member list shows each person's role in this shop.
        $rentalShop->members->each(fn ($m) => $m->setAttribute('shop_role_label', $m->shopRoleLabel()));

        $recentVehicles = $rentalShop->vehicles()
            ->with(['pricing:id,vehicle_id,daily_rate', 'images' => fn ($q) => $q->where('is_primary', true)->with('attachment:id,file_path,disk')])
            ->latest()
            ->limit(6)
            ->get(['id', 'shop_id', 'title', 'status', 'moderation_status', 'year', 'created_at'])
            ->map(fn (Vehicle $v) => [
                'id' => $v->id,
                'title' => $v->title,
                'status' => $v->status,
                'moderation_status' => $v->moderation_status,
                'daily_rate' => $v->pricing?->daily_rate,
                'image' => ($a = $v->images->first()?->attachment) ? Storage::disk($a->disk)->url($a->file_path) : null,
            ]);

        return $this->response('Shop retrieved', $rentalShop->toArray() + ['recent_vehicles' => $recentVehicles]);
    }

    public function verify(RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->verify($this->admin(), $rentalShop);

        return $this->response('Shop verified and published', $shop);
    }

    public function reject(ReasonRequest $request, RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->reject($this->admin(), $rentalShop, $request->validated('reason'));

        return $this->response('Shop rejected', $shop);
    }

    public function suspend(ReasonRequest $request, RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->suspend($this->admin(), $rentalShop, $request->validated('reason'));

        return $this->response('Shop suspended', $shop);
    }

    public function activate(RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->activate($this->admin(), $rentalShop);

        return $this->response('Shop activated', $shop);
    }

    public function destroy(ReasonRequest $request, RentalShop $rentalShop): JsonResponse
    {
        $this->service->delete($this->admin(), $rentalShop, $request->validated('reason'));

        return $this->response('Shop deleted');
    }

    /** A platform admin reviewing a submitted document — every access audited (see AuditService::view()). */
    public function downloadDocument(ShopVerification $verification): StreamedResponse
    {
        $attachment = $verification->attachment;
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->file_path), 404);

        AuditService::view('ShopVerification', $verification->id, $attachment->file_name);

        return Storage::disk($attachment->disk)->download($attachment->file_path, $attachment->file_name);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
