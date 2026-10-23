<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateSystemAdminRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = $this->route('systemAdmin')?->id;

        return [
            'name'     => 'sometimes|required|string|max:255',
            'email'    => "sometimes|required|email|unique:system_admins,email,{$id}",
            'password' => ['sometimes', 'nullable', 'string', Password::min(8)],
            'admin_role' => 'sometimes|required|in:platform_owner,admin,finance,moderator,support',
            'is_active' => 'sometimes|required|boolean',
        ];
    }
}
