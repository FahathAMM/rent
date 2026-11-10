<?php

namespace App\Http\Requests\Platform;

use App\Models\VehicleCategory;
use Illuminate\Foundation\Http\FormRequest;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'parent_id' => ['nullable', 'integer', 'exists:vehicle_categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'alpha_dash', 'unique:vehicle_categories,slug'],
            // A react-icons component name, e.g. MdDirectionsCarFilled (see frontend/src/lib/vehicleTypeIcons.jsx).
            'icon' => ['nullable', 'string', 'max:100', 'regex:/^[A-Za-z][A-Za-z0-9]*$/'],
            'description' => ['nullable', 'string', 'max:1000'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'default_min_rental_days' => ['nullable', 'integer', 'min:1'],
            ...VehicleCategory::translationRules(['name' => 'max:255', 'description' => 'max:1000']),
        ];
    }
}
