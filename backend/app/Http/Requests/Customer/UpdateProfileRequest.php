<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = auth('customer')->user()?->id;

        return [
            'name'   => 'sometimes|string|max:255',
            'email'  => "sometimes|email|unique:customers,email,{$id}",
            'phone'  => 'nullable|string|max:20',
            'avatar' => 'sometimes|nullable|image|max:2048',
        ];
    }
}
