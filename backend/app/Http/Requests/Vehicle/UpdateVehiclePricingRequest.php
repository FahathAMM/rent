<?php

namespace App\Http\Requests\Vehicle;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVehiclePricingRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'daily_rate' => ['required', 'numeric', 'min:0'],
            'weekly_rate' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate' => ['nullable', 'numeric', 'min:0'],
            'weekend_surcharge_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'deposit_method' => ['nullable', Rule::in(['prepaid', 'cash_on_pickup', 'waived'])],
            'mileage_allowance_per_day_km' => ['nullable', 'integer', 'min:0'],
            'excess_mileage_rate_per_km' => ['nullable', 'numeric', 'min:0'],
            'driver_rate_per_day' => ['nullable', 'numeric', 'min:0'],
            'delivery_available' => ['boolean'],
            'delivery_free_radius_km' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee_per_km' => ['nullable', 'numeric', 'min:0'],
            'delivery_flat_fee' => ['nullable', 'numeric', 'min:0'],
            'cleaning_fee' => ['nullable', 'numeric', 'min:0'],
            'late_return_fee_per_hour' => ['nullable', 'numeric', 'min:0'],
            'fuel_policy' => ['nullable', Rule::in(['full_to_full', 'prepaid', 'same_level'])],
            'min_rental_days' => ['nullable', 'integer', 'min:1'],
            'max_rental_days' => ['nullable', 'integer', 'gte:min_rental_days'],
            'advance_notice_hours' => ['nullable', 'integer', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
