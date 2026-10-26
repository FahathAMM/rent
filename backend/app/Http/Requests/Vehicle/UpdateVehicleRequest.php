<?php

namespace App\Http\Requests\Vehicle;

use App\Support\VendorContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVehicleRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $vehicle = $this->route('vehicle');
        $id = $vehicle?->id;
        // A partial update may change the model without resending the brand (or vice versa).
        $brandId = $this->input('brand_id', $vehicle?->brand_id);
        $modelId = $this->input('model_id', $vehicle?->model_id);

        return [
            'category_id' => ['sometimes', 'required', 'integer', 'exists:vehicle_categories,id'],
            'brand_id' => ['sometimes', 'required', 'integer', Rule::exists('vehicle_brands', 'id')->where('is_active', true)],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'model_id' => [
                Rule::requiredIf(fn () => $this->has('brand_id')), 'integer',
                Rule::exists('vehicle_models', 'id')->where('is_active', true)->where('brand_id', $brandId),
            ],
            'year' => ['sometimes', 'required', 'integer', 'min:1980', 'max:' . (date('Y') + 1)],
            'variant_id' => ['nullable', 'integer', Rule::exists('vehicle_variants', 'id')->where('is_active', true)->where('model_id', $modelId)],
            'colour_id' => ['nullable', 'integer', Rule::exists('vehicle_colours', 'id')->where('is_active', true)],
            'registration_number' => [
                'sometimes', 'required', 'string', 'max:20',
                Rule::unique('vehicles', 'registration_number')->where('shop_id', VendorContext::shopId())->ignore($id),
            ],
            'transmission' => ['sometimes', 'required', Rule::in(['manual', 'automatic', 'semi_automatic', 'cvt'])],
            'fuel_type' => ['sometimes', 'required', Rule::in(['petrol', 'diesel', 'hybrid', 'electric', 'lpg'])],
            'engine_capacity_cc' => ['nullable', 'integer', 'min:0'],
            'seating_capacity' => ['sometimes', 'required', 'integer', 'min:1', 'max:60'],
            'luggage_capacity' => ['nullable', 'integer', 'min:0'],
            'doors' => ['nullable', 'integer', 'min:0', 'max:6'],
            'air_conditioned' => ['boolean'],
            'features' => ['nullable', 'array'],
            'description' => ['nullable', 'string'],
            'condition_notes' => ['nullable', 'string'],
        ];
    }
}
