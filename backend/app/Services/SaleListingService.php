<?php

namespace App\Services;

use App\Http\Requests\Sale\StoreSaleListingRequest;
use App\Http\Requests\Sale\UpdateSaleListingRequest;
use App\Models\Booking;
use App\Models\SaleEnquiry;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use App\Repositories\VehicleRepo;
use App\Support\VendorContext;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A shop's sale listings, and moving a vehicle between rent and sale — see
 * app-doc/marketplace/13-vehicle-sales.md section 4. The vehicle half is
 * VehicleRepo's, so photos, the catalogue and moderation work as for rentals.
 */
class SaleListingService
{
    public function __construct(
        private VehicleRepo $vehicles,
        private SubscriptionService $subscriptions,
        private SaleEnquiryService $enquiries,
    ) {}

    public function create(StoreSaleListingRequest $request): Vehicle
    {
        $this->subscriptions->ensureCanAddSaleListing(VendorContext::shopId());

        return DB::transaction(function () use ($request) {
            $vehicle = $this->vehicles->store($request, Vehicle::LISTING_SALE);
            $this->saveDetail($vehicle, $request->validated());

            return $vehicle->load('saleDetail');
        });
    }

    public function update(Vehicle $vehicle, UpdateSaleListingRequest $request): Vehicle
    {
        $this->assertNotSold($vehicle);

        return DB::transaction(function () use ($vehicle, $request) {
            $updated = $this->vehicles->update($vehicle, $request);
            $this->saveDetail($updated, $request->validated());

            return $updated->load('saleDetail');
        });
    }

    public function publish(Vehicle $vehicle): Vehicle
    {
        $this->assertNotSold($vehicle);
        $this->vehicles->assertCanPublish($vehicle);
        $this->subscriptions->ensureCanPublishSaleListing($vehicle);

        return DB::transaction(function () use ($vehicle) {
            $vehicle->saleDetail->update(['sale_status' => VehicleSaleDetail::STATUS_AVAILABLE]);

            return $this->vehicles->publish($vehicle)->load('saleDetail');
        });
    }

    /** Off the Buy page, but still the shop's. Open enquiries stay open — the shop may relist. */
    public function withdraw(Vehicle $vehicle): Vehicle
    {
        $this->assertNotSold($vehicle);

        return DB::transaction(function () use ($vehicle) {
            $vehicle->saleDetail->update(['sale_status' => VehicleSaleDetail::STATUS_WITHDRAWN]);

            return ($vehicle->status === Vehicle::STATUS_PUBLISHED ? $this->vehicles->unpublish($vehicle, 'Withdrawn from sale') : $vehicle)->load('saleDetail');
        });
    }

    public function destroy(Vehicle $vehicle): void
    {
        // A sold car is part of the shop's records (and its sale agreement).
        $this->assertNotSold($vehicle);

        DB::transaction(function () use ($vehicle) {
            $this->enquiries->closeAllFor($vehicle, 'The listing was removed');
            $this->vehicles->destroy($vehicle);
        });
    }

    /**
     * Rent → sale. Refused while any booking is still in play — a pending
     * request too, since the shop could accept it after the car is gone.
     */
    public function switchToSale(Vehicle $vehicle, array $details): Vehicle
    {
        $this->subscriptions->ensureCanAddSaleListing($vehicle->shop_id);

        return DB::transaction(function () use ($vehicle, $details) {
            // Same row BookingService::create() locks, so a booking can't slip in behind this check.
            $this->lockVehicle($vehicle);

            $open = Booking::where('vehicle_id', $vehicle->id)
                ->whereIn('status', [Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
                ->count();
            if ($open) {
                throw ValidationException::withMessages(['listing_type' => ["This vehicle still has {$open} open booking(s). Finish or cancel them first."]]);
            }

            $this->changeType($vehicle, Vehicle::LISTING_SALE);
            $this->saveDetail($vehicle, $details + ['sale_status' => VehicleSaleDetail::STATUS_WITHDRAWN]);

            return $vehicle->fresh(['saleDetail', 'category']);
        });
    }

    /** Sale → rent. The sale details are kept (withdrawn) in case it goes back. */
    public function switchToRent(Vehicle $vehicle): Vehicle
    {
        $this->assertNotSold($vehicle);
        $this->subscriptions->ensureCanAddVehicle($vehicle->shop_id);

        if (blank($vehicle->registration_number)) {
            throw ValidationException::withMessages(['registration_number' => ['Add the registration number first — a rental needs one.']]);
        }

        return DB::transaction(function () use ($vehicle) {
            $this->lockVehicle($vehicle);

            $open = SaleEnquiry::where('vehicle_id', $vehicle->id)->open()->count();
            if ($open) {
                throw ValidationException::withMessages(['listing_type' => ["This car still has {$open} open enquiry(ies). Close them first."]]);
            }

            $vehicle->saleDetail?->update(['sale_status' => VehicleSaleDetail::STATUS_WITHDRAWN]);
            $this->changeType($vehicle, Vehicle::LISTING_RENT);

            return $vehicle->fresh(['category', 'pricing']);
        });
    }

    /**
     * A new type is a new listing: it comes off the marketplace and goes back
     * through moderation. A rejected or flagged car stays that way, so
     * switching can't be used to shake off a takedown.
     */
    private function changeType(Vehicle $vehicle, string $type): void
    {
        if ($vehicle->status === Vehicle::STATUS_PUBLISHED) {
            $this->vehicles->unpublish($vehicle, "Moved to {$type}");
        }

        $vehicle->refresh();
        $vehicle->update(array_filter([
            'listing_type' => $type,
            'moderation_status' => $vehicle->moderation_status === Vehicle::MODERATION_APPROVED ? Vehicle::MODERATION_PENDING : null,
        ]));
    }

    private function saveDetail(Vehicle $vehicle, array $data): void
    {
        $fields = Arr::only($data, [...VehicleSaleDetail::EDITABLE, 'sale_status']);

        VehicleSaleDetail::updateOrCreate(['vehicle_id' => $vehicle->id], $fields + ['shop_id' => $vehicle->shop_id]);
    }

    private function lockVehicle(Vehicle $vehicle): void
    {
        DB::table('vehicles')->where('id', $vehicle->id)->lockForUpdate()->first();
    }

    private function assertNotSold(Vehicle $vehicle): void
    {
        if ($vehicle->saleDetail?->isSold()) {
            throw ValidationException::withMessages(['sale_status' => ['This car has been sold.']]);
        }
    }
}
