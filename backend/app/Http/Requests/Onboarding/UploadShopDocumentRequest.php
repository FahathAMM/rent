<?php

namespace App\Http\Requests\Onboarding;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadShopDocumentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'document_type' => ['required', Rule::in([
                'business_registration', 'tax_identification', 'bank_statement',
                'insurance_policy', 'trade_licence', 'lease_agreement', 'other',
            ])],
            'file' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf'],
        ];
    }
}
