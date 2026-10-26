<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create + update - the name only has to be unique within its model. */
class SaveVehicleVariantRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'model_id' => ['required', 'integer', 'exists:vehicle_models,id'],
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('vehicle_variants', 'name')->where('model_id', $this->input('model_id'))->ignore($this->route('variant')?->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
