<?php

namespace App\Http\Requests\Platform;

use App\Models\PlatformDetail;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePlatformDetailRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:255',
            'tagline'    => 'nullable|string|max:255',
            'logo'       => 'sometimes|nullable|image|max:2048',
            'login_logo' => 'sometimes|nullable|image|max:2048',
            'login_eyebrow'     => 'nullable|string|max:255',
            'login_heading'     => 'nullable|string|max:255',
            'login_description' => 'nullable|string|max:500',
            ...PlatformDetail::translationRules(['tagline' => 'max:255', 'login_eyebrow' => 'max:255', 'login_heading' => 'max:255', 'login_description' => 'max:500']),
        ];
    }
}
