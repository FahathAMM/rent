<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public endpoint
    }

    public function rules(): array
    {
        return [
            'company_name' => ['required', 'string', 'max:255'],
            'name'         => ['required', 'string', 'max:255'],
            'email'        => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone'        => ['nullable', 'string', 'max:30'],
            'password'     => ['required', 'confirmed', Password::min(8)],
            // Optional — the public pricing grid picks a plan; CreateCompanyAction
            // falls back to the lowest-sort-order active plan when omitted.
            'plan_id'      => ['nullable', 'integer', Rule::exists('plans', 'id')->where('status', 'active')],
        ];
    }
}
