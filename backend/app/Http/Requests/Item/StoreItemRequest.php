<?php

namespace App\Http\Requests\Item;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreItemRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('items', 'name')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'sku'            => 'nullable|string|max:100',
            'category'       => 'nullable|string|max:100',
            'icon'           => ['nullable', Rule::in(['drumstick', 'chicken', 'egg', 'package', 'snowflake', 'wheat', 'fish', 'beef', 'milk'])],
            'unit_id'        => [
                'required', 'integer',
                Rule::exists('units', 'id')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price'  => 'nullable|numeric|min:0',
            'tax_rate'       => 'nullable|numeric|min:0|max:100',
            'is_active'      => 'boolean',
            'notes'          => 'nullable|string',
        ];
    }
}
