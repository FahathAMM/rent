<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\StoreSaleListingRequest;
use App\Http\Requests\Sale\UpdateSaleListingRequest;
use App\Http\Resources\Vendor\VehicleResource;
use App\Models\Vehicle;
use App\Repositories\VehicleRepo;
use App\Services\AuditService;
use App\Services\SaleListingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The shop's cars for sale. ShopScope has already confined {vehicle}; VehiclePolicy checks vendor-sales-listings-*. */
class SaleListingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private SaleListingService $service, private VehicleRepo $vehicles)
    {
        $this->middleware('can:vendor-sales-listings-view')->only('index');
        $this->middleware('can:vendor-sales-listings-create')->only(['store', 'switchToSale']);
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record' => $this->vehicles->getData($request, Vehicle::LISTING_SALE),
            'message' => 'Sale listings retrieved',
            'status' => true,
        ]);
    }

    public function store(StoreSaleListingRequest $request): JsonResponse
    {
        $vehicle = $this->service->create($request);
        AuditService::create('Vehicle', $vehicle->id, $vehicle->title);

        return $this->response('Listing created', new VehicleResource($vehicle), 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('view', $vehicle);

        return $this->response('Listing retrieved', new VehicleResource($vehicle->load(['category', 'saleDetail', 'images.attachment'])));
    }

    public function update(UpdateSaleListingRequest $request, Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('update', $vehicle);

        $vehicle = $this->service->update($vehicle, $request);
        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title);

        return $this->response('Listing updated', new VehicleResource($vehicle));
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('delete', $vehicle);

        $name = $vehicle->title;
        $this->service->destroy($vehicle);
        AuditService::delete('Vehicle', $vehicle->id, $name);

        return $this->response('Listing deleted');
    }

    public function publish(Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('publish', $vehicle);

        return $this->response('Listing published', new VehicleResource($this->service->publish($vehicle)));
    }

    public function withdraw(Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('update', $vehicle);

        return $this->response('Listing withdrawn', new VehicleResource($this->service->withdraw($vehicle)));
    }

    public function switchToRent(Vehicle $vehicle): JsonResponse
    {
        $this->assertSale($vehicle);
        $this->authorize('update', $vehicle);

        $vehicle = $this->service->switchToRent($vehicle);
        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['listing_type' => Vehicle::LISTING_RENT]);

        return $this->response('Moved to rentals — publish it again once it passes review', new VehicleResource($vehicle));
    }

    /** {vehicle} is a rental here: vendor-vehicles-list-edit to change it, on top of the -create check above. */
    public function switchToSale(Request $request, Vehicle $vehicle): JsonResponse
    {
        abort_if($vehicle->isForSale(), 404);
        $this->authorize('update', $vehicle);

        $vehicle = $this->service->switchToSale($vehicle, $request->validate(StoreSaleListingRequest::saleRules()));
        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['listing_type' => Vehicle::LISTING_SALE]);

        return $this->response('Moved to sales — publish it once it passes review', new VehicleResource($vehicle));
    }

    private function assertSale(Vehicle $vehicle): void
    {
        abort_unless($vehicle->isForSale(), 404);
    }
}
