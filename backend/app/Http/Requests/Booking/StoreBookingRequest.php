<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'pickup_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'return_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'return_address' => ['nullable', 'string', 'max:255'],
            'delivery_requested' => ['nullable', 'boolean'],
            'with_driver' => ['nullable', 'boolean'],
            'customer_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
