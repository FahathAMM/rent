<?php

namespace App\Http\Requests\Vendor;

use App\Support\ShopAbilities;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InviteStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['required', 'in:manager,staff'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => [Rule::in(ShopAbilities::all())],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'joining_date' => ['nullable', 'date'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return ['email.exists' => 'No marketplace account exists with that email yet — they need to sign up first.'];
    }
}
