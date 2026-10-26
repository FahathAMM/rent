<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'role' => ['required', 'in:manager,staff'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string'],
        ];
    }
}
