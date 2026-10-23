<?php

namespace App\Http\Requests\Customer;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('customers', 'name')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'phone'              => 'nullable|string|max:50',
            'email'              => 'nullable|email|max:255',
            'address'            => 'nullable|string',
            'credit_terms_days'  => 'nullable|integer|min:0|max:365',
            'notes'              => 'nullable|string',
        ];
    }
}
