<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCommissionRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'scope_type' => ['required', 'in:global,category,shop,vehicle'],
            'scope_id' => ['nullable', 'integer'],
            'percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'min_amount' => ['nullable', 'numeric', 'min:0'],
            'max_amount' => ['nullable', 'numeric', 'min:0', 'gte:min_amount'],
            'applies_to' => ['required', 'in:rental_only,rental_plus_extras'],
            'processing_fee_borne_by' => ['required', 'in:platform,owner,split'],
            'priority' => ['nullable', 'integer'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            if ($this->input('scope_type') !== 'global' && !$this->filled('scope_id')) {
                $validator->errors()->add('scope_id', 'A scope id is required unless the scope is global.');
            }
        });
    }
}
