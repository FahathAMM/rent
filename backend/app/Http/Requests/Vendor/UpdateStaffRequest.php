<?php

namespace App\Http\Requests\Vendor;

use App\Support\ShopAbilities;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'role' => ['required', 'in:manager,staff'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => [Rule::in(ShopAbilities::all())],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'joining_date' => ['nullable', 'date'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
        ];
    }
}
