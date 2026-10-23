<?php

namespace App\Http\Requests\Location;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLocationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('locations', 'name')
                    ->where(fn ($q) => $q->where('company_id', Tenant::id()))
                    ->ignore($this->route('location')),
            ],
            'address'         => 'nullable|string',
            'city'            => 'nullable|string|max:255',
            'state'           => 'nullable|string|max:255',
            'country'         => 'nullable|string|max:255',
            'latitude'        => 'nullable|numeric|between:-90,90',
            'longitude'       => 'nullable|numeric|between:-180,180',
            'phone'           => 'nullable|string|max:30',
            'email'           => 'nullable|email|max:255',
            'contact_person'  => 'nullable|string|max:255',
            'working_hours'   => 'nullable|string|max:255',
            'is_active'       => 'boolean',
            'notes'           => 'nullable|string',
        ];
    }
}
