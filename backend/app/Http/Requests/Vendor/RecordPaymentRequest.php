<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

/** A payment the shop received outside the app - the balance limit is checked in BankTransferService::recordByShop(). */
class RecordPaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'method' => ['required', 'in:cash,bank_transfer'],
            'amount' => ['required', 'numeric', 'min:1'],
            'paid_at' => ['nullable', 'date', 'before_or_equal:now'],
            'reference' => ['nullable', 'string', 'max:100'],
            'proof' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
        ];
    }
}
