<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\StoreVehicleRequest;
use App\Http\Requests\Vehicle\UpdateVehicleRequest;
use App\Http\Requests\Vehicle\UpdateVehiclePricingRequest;
use App\Http\Resources\Vendor\VehicleResource;
use App\Models\Vehicle;
use App\Models\VehiclePricing;
use App\Repositories\VehicleRepo;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The owner/staff view of their own shop's vehicles. ShopScope (via
 * Vehicle's BelongsToShop) has already confined every {vehicle} route
 * parameter to the active shop before it reaches here - an id belonging
 * to another shop 404s at route-model-binding time. VehiclePolicy is the
 * second, explicit check (ability-gated, not just shop-gated).
 */
class VehicleController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private VehicleRepo $repo) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Vehicle::class);

        $vehicles = $this->repo->getData($request);

        return response()->json([
            'record' => $vehicles,
            'message' => 'Vehicles retrieved successfully',
            'status' => true,
        ]);
    }

    public function store(StoreVehicleRequest $request): JsonResponse
    {
        $this->authorize('create', Vehicle::class);

        $vehicle = $this->repo->store($request);

        AuditService::create('Vehicle', $vehicle->id, $vehicle->title);

        return $this->response('Vehicle created successfully', new VehicleResource($vehicle), 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('view', $vehicle);

        $vehicle->load(['category', 'pricing', 'images.attachment', 'pickupLocations.location']);

        return $this->response('Vehicle retrieved successfully', new VehicleResource($vehicle));
    }

    public function update(UpdateVehicleRequest $request, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('update', $vehicle);

        $vehicle = $this->repo->update($vehicle, $request);

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title);

        return $this->response('Vehicle updated successfully', new VehicleResource($vehicle));
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('delete', $vehicle);

        $name = $vehicle->title;
        $this->repo->destroy($vehicle);

        AuditService::delete('Vehicle', $vehicle->id, $name);

        return $this->response('Vehicle deleted successfully');
    }

    public function publish(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('publish', $vehicle);

        abort_unless($vehicle->moderation_status === Vehicle::MODERATION_APPROVED, 422,
            'This vehicle must pass moderation before it can be published.');

        $vehicle = $this->repo->publish($vehicle);

        return $this->response('Vehicle published', new VehicleResource($vehicle));
    }

    public function unpublish(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('update', $vehicle);

        $vehicle = $this->repo->unpublish($vehicle);

        return $this->response('Vehicle unpublished', new VehicleResource($vehicle));
    }

    public function archive(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('delete', $vehicle);

        $vehicle = $this->repo->archive($vehicle);

        return $this->response('Vehicle archived', new VehicleResource($vehicle));
    }

    public function updatePricing(UpdateVehiclePricingRequest $request, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('managePricing', $vehicle);

        $pricing = VehiclePricing::updateOrCreate(
            ['vehicle_id' => $vehicle->id],
            $request->validated() + ['updated_by' => AuthUser::id()]
        );

        AuditService::edit('VehiclePricing', $vehicle->id, $vehicle->title);

        return $this->response('Pricing updated successfully', $pricing);
    }
}
