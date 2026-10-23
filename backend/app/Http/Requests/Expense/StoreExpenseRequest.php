<?php

namespace App\Http\Requests\Expense;

use App\Support\VendorContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'vehicle_id' => [
                'nullable', 'integer',
                Rule::exists('vehicles', 'id')->where(fn ($q) => $q->where('shop_id', VendorContext::shopId())),
            ],
            'expense_category_id' => [
                'nullable', 'integer',
                Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('shop_id', VendorContext::shopId())),
            ],
            'expense_date'     => 'required|date',
            'expense_type'     => 'required|in:fuel,service,repair,insurance,revenue_licence,emission_test,tyres,cleaning,parking,fine,other',
            'odometer_reading' => 'nullable|integer|min:0',
            'vendor_name'      => 'nullable|string|max:255',
            'description'      => 'nullable|string|max:255',
            'subtotal'         => 'required|numeric|min:0',
            'tax_rate'         => 'nullable|numeric|min:0|max:100',
            'payment_method'   => 'nullable|string|max:50',
            'reference_no'     => 'nullable|string|max:100',
            'notes'            => 'nullable|string',
        ];
    }
}
