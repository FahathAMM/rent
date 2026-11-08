<?php

namespace App\Actions;

use App\Models\Administration\User;
use App\Models\SaleEnquiry;
use App\Models\Vehicle;
use App\Models\VehicleSale;
use App\Models\VehicleSaleDetail;
use App\Repositories\VehicleRepo;
use App\Services\AuditService;
use App\Services\PromotionService;
use App\Services\SaleAgreementService;
use App\Services\SaleEnquiryService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The sale itself, in one transaction: save the deal → mark the car sold →
 * take it off the Buy page → stop its featuring → close the other enquiries.
 * The money changes hands at the shop; this records it. See
 * app-doc/marketplace/13-vehicle-sales.md section 3.7.
 */
class RecordVehicleSale
{
    public function __construct(
        private SaleAgreementService $agreements,
        private SaleEnquiryService $enquiries,
        private PromotionService $promotions,
        private VehicleRepo $vehicles,
    ) {}

    public function __invoke(User $staff, Vehicle $vehicle, array $data): VehicleSale
    {
        $sale = DB::transaction(function () use ($staff, $vehicle, $data) {
            // Two staff recording the same car: the second waits here, then finds it sold.
            $detail = VehicleSaleDetail::whereKey($vehicle->id)->lockForUpdate()->first();
            if (!$detail || $detail->isSold()) {
                throw ValidationException::withMessages(['vehicle' => ['This car has already been sold.']]);
            }

            $enquiry = $this->enquiry($vehicle, $data['enquiry_reference'] ?? null);
            $reference = 'SAL-' . Str::upper(Str::random(8));
            $signed = $this->agreements->capture($vehicle->shop_id, $reference, $data['customer_signature'] ?? null, (bool) ($data['terms_accepted'] ?? false));

            $sale = VehicleSale::create($signed + [
                'reference' => $reference,
                'vehicle_id' => $vehicle->id,
                'shop_id' => $vehicle->shop_id,
                'customer_id' => $enquiry?->customer_id,
                'enquiry_id' => $enquiry?->id,
                'buyer_name' => $data['buyer_name'],
                'buyer_phone' => $data['buyer_phone'],
                'buyer_nic' => $data['buyer_nic'],
                'buyer_address' => $data['buyer_address'] ?? null,
                'sale_price' => $data['sale_price'],
                'payment_method' => $data['payment_method'],
                'sold_at' => !empty($data['sold_at']) ? Carbon::parse($data['sold_at'], config('app.timezone')) : now(),
                'recorded_by' => $staff->id,
            ]);

            $detail->update(['sale_status' => VehicleSaleDetail::STATUS_SOLD]);
            if ($vehicle->status === Vehicle::STATUS_PUBLISHED) {
                $this->vehicles->unpublish($vehicle, 'Sold');
            }
            $this->promotions->endForSoldVehicle($vehicle);

            $enquiry?->update(['status' => SaleEnquiry::STATUS_ACCEPTED, 'closed_reason' => 'Sold to you']);
            $this->enquiries->closeAllFor($vehicle, 'Sold to another buyer', $enquiry?->id);

            return $sale;
        });

        AuditService::create('VehicleSale', $sale->id, $sale->reference);

        return $sale;
    }

    /** The enquiry the deal came from: it must be about this car. */
    private function enquiry(Vehicle $vehicle, ?string $reference): ?SaleEnquiry
    {
        if (!$reference) {
            return null;
        }

        $enquiry = SaleEnquiry::where('vehicle_id', $vehicle->id)->where('reference', $reference)->first();
        if (!$enquiry) {
            throw ValidationException::withMessages(['enquiry_reference' => ['That enquiry is not about this car.']]);
        }

        return $enquiry;
    }
}
