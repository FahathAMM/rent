<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class MarkPayoutPaidRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'evidence_reference' => ['required_without:evidence_attachment_id', 'nullable', 'string', 'max:255'],
            'evidence_attachment_id' => ['required_without:evidence_reference', 'nullable', 'integer', 'exists:attachments,id'],
        ];
    }
}
