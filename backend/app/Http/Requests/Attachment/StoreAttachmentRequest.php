<?php

namespace App\Http\Requests\Attachment;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAttachmentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            // Short morph-map aliases only (see AppServiceProvider::boot) — never a raw class name.
            'attachable_type' => ['required', Rule::in(['expense'])],
            'attachable_id'   => 'required|integer',
            'file'            => 'required|file|max:10240',
            'document_type'   => 'nullable|string|max:100',
        ];
    }
}
