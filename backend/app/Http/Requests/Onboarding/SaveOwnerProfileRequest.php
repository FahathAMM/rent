<?php

namespace App\Http\Requests\Onboarding;

use Illuminate\Foundation\Http\FormRequest;

class SaveOwnerProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'nic_number' => ['required', 'string', 'max:20'],
            'date_of_birth' => ['nullable', 'date', 'before:-18 years'],
            'contact_phone' => ['required', 'string', 'max:20'],
            'alt_phone' => ['nullable', 'string', 'max:20'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'terms_accepted' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['date_of_birth.before' => 'You must be at least 18 years old to apply.'];
    }
}
