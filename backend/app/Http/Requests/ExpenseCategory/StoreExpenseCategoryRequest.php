<?php

namespace App\Http\Requests\ExpenseCategory;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('expense_categories', 'name')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ];
    }
}
