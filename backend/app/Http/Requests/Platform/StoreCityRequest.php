<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'district_id' => ['required', 'integer', 'exists:districts,id'],
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('cities')->where('district_id', $this->input('district_id')),
            ],
        ];
    }
}
