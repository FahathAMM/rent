<?php

namespace App\Http\Requests\Sale;

use App\Http\Requests\Vehicle\UpdateVehicleRequest;
use App\Support\VendorContext;
use Illuminate\Validation\Rule;

class UpdateSaleListingRequest extends UpdateVehicleRequest
{
    public function rules(): array
    {
        $vehicle = $this->route('vehicle');
        $condition = $this->input('condition', $vehicle?->saleDetail?->condition);

        $sale = array_map(fn (array $rules) => in_array('required', $rules, true) ? ['sometimes', ...$rules] : $rules, StoreSaleListingRequest::saleRules());

        return array_merge(parent::rules(), $sale, [
            'registration_number' => [
                'sometimes', Rule::requiredIf($condition === 'used'), 'nullable', 'string', 'max:20',
                Rule::unique('vehicles', 'registration_number')->where('shop_id', VendorContext::shopId())->ignore($vehicle?->id),
            ],
        ]);
    }
}
