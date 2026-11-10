<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSupportContactRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'support_email' => ['nullable', 'email', 'max:255'],
            'support_phone' => ['nullable', 'string', 'max:30'],
            'support_whatsapp' => ['nullable', 'string', 'max:30'],
            'support_address' => ['nullable', 'string', 'max:500'],
            'support_hours' => ['nullable', 'string', 'max:255'],
        ];
    }
}
