<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

class StoreBankDetailRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** On update (PUT) a blank account_number keeps the stored one - it's never sent back to the form. */
    public function rules(): array
    {
        return [
            'account_holder_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['required', 'string', 'max:255'],
            'bank_code' => ['nullable', 'string', 'max:50'],
            'branch_name' => ['nullable', 'string', 'max:255'],
            'branch_code' => ['nullable', 'string', 'max:50'],
            'account_number' => [$this->isMethod('put') ? 'nullable' : 'required', 'string', 'max:50'],
            'account_type' => ['nullable', 'string', 'max:50'],
            'is_primary' => ['nullable', 'boolean'],
        ];
    }
}
