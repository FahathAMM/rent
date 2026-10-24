<?php

namespace App\Http\Requests\Dispute;

use Illuminate\Foundation\Http\FormRequest;

class StoreDisputeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'booking_reference' => ['required', 'string'],
            'against_side' => ['required', 'in:customer,owner,platform'],
            'category' => ['required', 'in:damage,no_show,overcharge,vehicle_condition,refund,late_return,fraud,other'],
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'claimed_amount' => ['nullable', 'numeric', 'min:0'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ];
    }
}
