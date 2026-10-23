<?php

namespace App\Http\Requests\ExpenseCategory;

use App\Support\VendorContext;
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
                Rule::unique('expense_categories', 'name')->where(fn ($q) => $q->where('shop_id', VendorContext::shopId())),
            ],
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ];
    }
}
