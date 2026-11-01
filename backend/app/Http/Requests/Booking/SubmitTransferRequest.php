<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

/** A bank transfer receipt from the customer - amount limits (advance / balance) are checked in BankTransferService. */
class SubmitTransferRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:1'],
            'transfer_reference' => ['nullable', 'string', 'max:100'],
            'proof' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'proof.required' => 'Attach the transfer receipt (PDF or image).',
            'proof.mimes' => 'The receipt must be a PDF or an image (JPG, PNG, WEBP).',
            'proof.max' => 'The receipt must be 5 MB or smaller.',
        ];
    }
}
