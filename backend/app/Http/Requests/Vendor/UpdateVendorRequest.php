<?php

namespace App\Http\Requests\Vendor;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVendorRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('vendors', 'name')
                    ->where(fn ($q) => $q->where('company_id', Tenant::id()))
                    ->ignore($this->route('vendor')),
            ],
            'contact_person' => 'nullable|string|max:255',
            'email'          => 'nullable|email|max:255',
            'phone'          => 'nullable|string|max:50',
            'address'        => 'nullable|string',
            'tax_number'     => 'nullable|string|max:100',
            'notes'          => 'nullable|string',
        ];
    }
}
