<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = $this->user()?->id;

        return [
            'name'   => 'sometimes|string|max:255',
            'email'  => "sometimes|email|unique:users,email,{$id}",
            'phone'  => 'nullable|string|max:20',
            // Raster formats only — an SVG is a document that can carry scripts, and /storage is served on the app's own origin.
            'avatar' => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }
}
