<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

/** New pickup/return for a confirmed booking, or new return for an active one - status, overlap, pricing and whether a refund is needed are checked in TransitionBooking::reschedule(). */
class RescheduleBookingRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'reason' => ['nullable', 'string', 'max:255'],
            'refund_method' => ['nullable', 'in:cash,bank_transfer'],
        ];
    }
}
