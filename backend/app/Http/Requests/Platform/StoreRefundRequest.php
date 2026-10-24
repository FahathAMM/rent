<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class StoreRefundRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'booking_reference' => ['required', 'string', 'exists:bookings,booking_reference'],
            'payment_id' => ['nullable', 'integer', 'exists:payments,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'type' => ['required', 'in:cancellation,deposit_return,overcharge,damage_waiver,goodwill,chargeback,no_show_partial'],
            'reason' => ['nullable', 'string', 'max:500'],
            'method' => ['required', 'in:gateway,bank_transfer,cash,credit_note'],
        ];
    }
}
