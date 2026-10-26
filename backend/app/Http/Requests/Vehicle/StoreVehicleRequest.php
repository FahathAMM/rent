<?php

namespace App\Http\Requests\Vehicle;

use App\Support\VendorContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVehicleRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:vehicle_categories,id'],
            'brand_id' => ['required', 'integer', Rule::exists('vehicle_brands', 'id')->where('is_active', true)],
            'title' => ['required', 'string', 'max:255'],
            // The model must sit under the chosen brand, the variant under the chosen model.
            'model_id' => ['required', 'integer', Rule::exists('vehicle_models', 'id')->where('is_active', true)->where('brand_id', $this->input('brand_id'))],
            'year' => ['required', 'integer', 'min:1980', 'max:' . (date('Y') + 1)],
            'variant_id' => ['nullable', 'integer', Rule::exists('vehicle_variants', 'id')->where('is_active', true)->where('model_id', $this->input('model_id'))],
            'colour_id' => ['nullable', 'integer', Rule::exists('vehicle_colours', 'id')->where('is_active', true)],
            'registration_number' => [
                'required', 'string', 'max:20',
                Rule::unique('vehicles', 'registration_number')->where('shop_id', VendorContext::shopId()),
            ],
            'transmission' => ['required', Rule::in(['manual', 'automatic', 'semi_automatic', 'cvt'])],
            'fuel_type' => ['required', Rule::in(['petrol', 'diesel', 'hybrid', 'electric', 'lpg'])],
            'engine_capacity_cc' => ['nullable', 'integer', 'min:0'],
            'seating_capacity' => ['required', 'integer', 'min:1', 'max:60'],
            'luggage_capacity' => ['nullable', 'integer', 'min:0'],
            'doors' => ['nullable', 'integer', 'min:0', 'max:6'],
            'air_conditioned' => ['boolean'],
            'features' => ['nullable', 'array'],
            'description' => ['nullable', 'string'],
            'condition_notes' => ['nullable', 'string'],
        ];
    }
}
