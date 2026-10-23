<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanySettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // controller-level policy check
    }

    public function rules(): array
    {
        return [
            'invoice_prefix'   => 'sometimes|string|max:10',
            'expense_prefix'   => 'sometimes|string|max:10',
            'invoice_footer'   => 'nullable|string',
        ];
    }
}
