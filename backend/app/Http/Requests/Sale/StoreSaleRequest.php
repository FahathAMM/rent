<?php

namespace App\Http\Requests\Sale;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $companyId = Tenant::id();

        return [
            // No customer_id at all = walk-in; walk_in_name is an optional
            // free-text label for the receipt in that case.
            'customer_id' => [
                'nullable', 'integer',
                Rule::exists('customers', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'walk_in_name'   => 'nullable|string|max:255',
            'sale_date'      => 'required|date',
            'due_date'       => 'nullable|date|after_or_equal:sale_date',
            'reference_no'   => 'nullable|string|max:100',
            'status'         => 'nullable|in:completed,cancelled',
            'discount_type'  => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'paid_amount'    => 'nullable|numeric|min:0',
            'notes'          => 'nullable|string',

            'items'                   => 'required|array|min:1',
            'items.*.item_id'         => [
                'nullable', 'integer',
                Rule::exists('items', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'items.*.description'     => 'required|string|max:255',
            'items.*.quantity'        => 'required|numeric|min:0.01',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'items.*.discount_type'   => 'nullable|in:percentage,fixed',
            'items.*.discount_value'  => 'nullable|numeric|min:0',
            'items.*.tax_rate'        => 'nullable|numeric|min:0|max:100',
        ];
    }
}
