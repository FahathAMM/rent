<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

/** Mirrors MarkPayoutPaidRequest's settlement-evidence requirement — a refund reaches `completed` only with real evidence of the money having moved. */
class CompleteRefundRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'gateway_refund_id' => ['required_without:evidence_reference', 'nullable', 'string', 'max:255'],
            'evidence_reference' => ['required_without:gateway_refund_id', 'nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
