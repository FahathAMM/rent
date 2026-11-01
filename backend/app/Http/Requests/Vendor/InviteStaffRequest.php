<?php

namespace App\Http\Requests\Vendor;

use App\Support\VendorContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The shop owner creates the staff member's login here — one account belongs
 * to one shop, so staff get a fresh users row rather than linking an
 * existing account (customers are a separate table and can't be reused).
 */
class InviteStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8'],
            // A role this shop's owner created (not shop-owner).
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('shop_id', VendorContext::shopId())->whereNot('name', 'shop-owner')],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'joining_date' => ['nullable', 'date'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return ['email.unique' => 'An account with this email already exists. Use a different email for this staff member.'];
    }
}
