<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class InspectionRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'odometer_reading' => ['nullable', 'integer', 'min:0'],
            'fuel_level' => ['nullable', 'in:empty,quarter,half,three_quarter,full'],
            'exterior_checklist' => ['nullable', 'array'],
            'interior_checklist' => ['nullable', 'array'],
            'accessories_checklist' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'customer_present' => ['nullable', 'boolean'],
            'damages' => ['nullable', 'array'],
            'damages.*.area' => ['required_with:damages', 'string', 'max:100'],
            'damages.*.description' => ['required_with:damages', 'string', 'max:1000'],
            'damages.*.severity' => ['required_with:damages', 'in:minor,moderate,major'],
            'damages.*.estimated_cost' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
