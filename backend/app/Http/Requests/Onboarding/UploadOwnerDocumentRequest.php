<?php

namespace App\Http\Requests\Onboarding;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadOwnerDocumentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'document_type' => ['required', Rule::in([
                'nic_front', 'nic_back', 'selfie_with_nic', 'proof_of_address',
                'driving_licence', 'vehicle_registration', 'insurance_certificate',
                'revenue_licence', 'other',
            ])],
            'file' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf'],
        ];
    }
}
