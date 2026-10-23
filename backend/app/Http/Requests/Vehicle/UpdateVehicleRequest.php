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
        $id = $this->route('vehicle')?->id;

        return [
            'category_id' => ['sometimes', 'required', 'integer', 'exists:vehicle_categories,id'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'make' => ['sometimes', 'required', 'string', 'max:100'],
            'model' => ['sometimes', 'required', 'string', 'max:100'],
            'year' => ['sometimes', 'required', 'integer', 'min:1980', 'max:' . (date('Y') + 1)],
            'variant' => ['nullable', 'string', 'max:100'],
            'colour' => ['nullable', 'string', 'max:50'],
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
