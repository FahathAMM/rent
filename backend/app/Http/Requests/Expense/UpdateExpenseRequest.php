<?php

namespace App\Http\Requests\Expense;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExpenseRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'expense_category_id' => [
                'nullable', 'integer',
                Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'expense_date'   => 'required|date',
            'vendor_name'    => 'nullable|string|max:255',
            'description'    => 'nullable|string|max:255',
            'subtotal'       => 'required|numeric|min:0',
            'tax_rate'       => 'nullable|numeric|min:0|max:100',
            'payment_method' => 'nullable|string|max:50',
            'reference_no'   => 'nullable|string|max:100',
            'notes'          => 'nullable|string',
        ];
    }
}
