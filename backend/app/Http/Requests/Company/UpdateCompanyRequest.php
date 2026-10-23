<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission-checked in the controller (needs the resolved Company instance)
    }

    public function rules(): array
    {
        return [
            'name'            => 'sometimes|string|max:255',
            'legal_name'      => 'nullable|string|max:255',
            'email'           => 'nullable|email|max:255',
            'phone'           => 'nullable|string|max:30',
            'website'         => 'nullable|string|max:255',
            'trn'             => 'nullable|string|max:50',
            'address_line_1'  => 'nullable|string|max:255',
            'address_line_2'  => 'nullable|string|max:255',
            'city'            => 'nullable|string|max:100',
            'emirate'         => 'nullable|string|max:100',
            'country'         => 'nullable|string|max:100',
            'currency'        => 'nullable|string|max:3',
            'timezone'        => 'nullable|string|max:64',
            // Shown as a small square icon in the sidebar/header (~32-40px) as
            // well as full-size on quotation/invoice PDFs, so it needs enough
            // resolution to stay sharp at both without allowing huge uploads.
            'logo'            => 'sometimes|nullable|image|max:2048|dimensions:min_width=64,min_height=64,max_width=1024,max_height=1024',
        ];
    }
}
