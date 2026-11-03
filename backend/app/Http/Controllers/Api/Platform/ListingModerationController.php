<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Services\ListingModerationService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListingModerationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ListingModerationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $vehicles = Vehicle::query()
            ->with([
                'category:id,name',
                'shop:id,name,city,district',
                'pricing:id,vehicle_id,daily_rate,weekly_rate,monthly_rate,security_deposit,driver_rate_per_day,mileage_allowance_per_day_km',
                'images' => fn ($q) => $q->where('is_primary', true)->with('attachment'),
            ])
            ->when($request->moderation_status, fn ($q) => $q->where('moderation_status', $request->moderation_status))
            ->when($request->search, fn ($q) => $q->where('title', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $vehicles, 'message' => 'Listings retrieved', 'status' => true]);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        $vehicle->load([
            'category', 'brand:id,name', 'vehicleModel:id,name', 'vehicleVariant:id,name', 'vehicleColour:id,name,hex',
            'shop:id,name,slug,logo,cover_image,city,district,status,verification_status,is_published,owner_user_id',
            'shop.owner:id,name,email,phone',
            'pricing', 'images.attachment', 'pickupLocations.location:id,name,address,city,district',
            'moderationHistory' => fn ($q) => $q->latest(),
        ])->loadCount(['bookings', 'reviews']);

        // History rows only carry actor ids — attach the admin's name for the timeline.
        $admins = SystemAdmin::whereIn('id', $vehicle->moderationHistory->where('actor_type', 'system_admin')->pluck('actor_id'))->pluck('name', 'id');
        $vehicle->moderationHistory->each(fn ($h) => $h->setAttribute(
            'actor_name',
            $h->actor_type === 'system_admin' ? ($admins[$h->actor_id] ?? 'Platform admin') : 'Shop',
        ));

        return $this->response('Listing retrieved', $vehicle);
    }

    public function approve(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing approved', $this->service->approve($this->admin(), $vehicle));
    }

    public function reject(ReasonRequest $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing rejected', $this->service->reject($this->admin(), $vehicle, $request->validated('reason')));
    }

    public function flag(ReasonRequest $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing flagged', $this->service->flag($this->admin(), $vehicle, $request->validated('reason')));
    }

    public function unpublish(Request $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing unpublished', $this->service->unpublish($this->admin(), $vehicle, $request->get('reason')));
    }

    public function republish(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing republished', $this->service->republish($this->admin(), $vehicle));
    }

    public function feature(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing featured', $this->service->feature($this->admin(), $vehicle));
    }

    public function unfeature(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing unfeatured', $this->service->unfeature($this->admin(), $vehicle));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
