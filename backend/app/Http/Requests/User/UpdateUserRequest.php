<?php

namespace App\Http\Requests\User;

use App\Services\AuthUser;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = $this->route('user')->id;

        return [
            'name'              => 'sometimes|string|max:255',
            'email'             => "sometimes|email|unique:users,email,{$id}",
            'password'          => ['sometimes', Password::min(8)],
            'roles'             => 'sometimes|nullable|array',
            'roles.*'           => 'string|exists:roles,name',
            'phone'             => 'nullable|string|max:20',
            'is_active'         => 'boolean',
            'avatar'            => 'sometimes|nullable|image|max:2048',
            'employee_id'       => "nullable|string|max:50|unique:users,employee_id,{$id}",
            'gender'            => 'nullable|in:male,female,other',
            'date_of_birth'     => 'nullable|date',
            'joining_date'      => 'nullable|date',
            'address'           => 'nullable|string|max:500',
            'emergency_contact' => 'nullable|string|max:100',
        ];
    }

    /** Only an existing super-admin may grant the super-admin role to anyone. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (in_array('super-admin', $this->input('roles', []), true) && !AuthUser::user()?->isSuperAdmin()) {
                $validator->errors()->add('roles', 'You are not allowed to assign the super-admin role.');
            }
        });
    }
}
