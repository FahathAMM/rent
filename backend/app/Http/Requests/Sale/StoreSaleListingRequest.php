<?php

namespace App\Http\Requests\Sale;

use App\Http\Requests\Vehicle\StoreVehicleRequest;
use App\Models\VehicleSaleDetail;
use App\Support\VendorContext;
use Illuminate\Validation\Rule;

/** The vehicle form's rules plus the sale fields. A new or reconditioned car may not be registered yet. */
class StoreSaleListingRequest extends StoreVehicleRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), self::saleRules(), [
            'registration_number' => [
                Rule::requiredIf(fn () => $this->input('condition') === 'used'), 'nullable', 'string', 'max:20',
                Rule::unique('vehicles', 'registration_number')->where('shop_id', VendorContext::shopId()),
            ],
        ]);
    }

    public static function saleRules(): array
    {
        return [
            'price' => ['required', 'numeric', 'min:1', 'max:999999999999'],
            'is_negotiable' => ['boolean'],
            'mileage_km' => ['required', 'integer', 'min:0', 'max:5000000'],
            'condition' => ['required', Rule::in(VehicleSaleDetail::CONDITIONS)],
            'owners_count' => ['nullable', 'integer', 'min:0', 'max:50'],
            'warranty_months' => ['nullable', 'integer', 'min:0', 'max:240'],
        ];
    }
}
