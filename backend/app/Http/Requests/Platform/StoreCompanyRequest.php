<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreCompanyRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'company_name'   => ['required', 'string', 'max:255'],
            'legal_name'     => ['nullable', 'string', 'max:255'],
            'email'          => ['nullable', 'email', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:30'],
            'website'        => ['nullable', 'string', 'max:255'],
            'trn'            => ['nullable', 'string', 'max:50'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city'           => ['nullable', 'string', 'max:100'],
            'emirate'        => ['nullable', 'string', 'max:100'],
            'country'        => ['nullable', 'string', 'max:100'],
            'currency'       => ['nullable', 'string', 'max:3'],
            'timezone'       => ['nullable', 'string', 'max:64'],

            'name'         => ['required', 'string', 'max:255'],
            'owner_email'  => ['required', 'email', 'max:255', 'unique:users,email'],
            'owner_phone'  => ['nullable', 'string', 'max:30'],
            'password'     => ['required', 'confirmed', Password::min(8)],

            'plan_id'              => ['nullable', 'integer', 'exists:plans,id'],
            'subscription_status'  => ['nullable', 'in:trial,active'],
        ];
    }
}
