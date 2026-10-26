<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

class InviteStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['required', 'in:manager,staff'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string'],
        ];
    }

    public function messages(): array
    {
        return ['email.exists' => 'No marketplace account exists with that email yet — they need to sign up first.'];
    }
}
