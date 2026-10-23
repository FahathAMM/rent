<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreSystemAdminRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:system_admins,email',
            'password' => ['required', 'string', Password::min(8)],
            'role'     => 'required|in:platform_owner,platform_admin',
        ];
    }
}
