<?php

namespace App\Http\Requests\Unit;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUnitRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('units', 'name')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'short_name' => 'nullable|string|max:20',
        ];
    }
}
