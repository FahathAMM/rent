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
            'title' => ['required', 'string', 'max:255'],
            'make' => ['required', 'string', 'max:100'],
            'model' => ['required', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:1980', 'max:' . (date('Y') + 1)],
            'variant' => ['nullable', 'string', 'max:100'],
            'colour' => ['nullable', 'string', 'max:50'],
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
