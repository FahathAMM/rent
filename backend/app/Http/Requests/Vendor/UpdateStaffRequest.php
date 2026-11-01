<?php

namespace App\Http\Requests\Vendor;

use App\Support\VendorContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            // Optional reset — blank keeps the current password.
            'password' => ['nullable', 'string', 'min:8'],
            // A role this shop's owner created (not shop-owner).
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('shop_id', VendorContext::shopId())->whereNot('name', 'shop-owner')],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'joining_date' => ['nullable', 'date'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
        ];
    }
}
