<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class StoreBrandRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * Brand logo upload: PNG/JPG/WebP up to 2 MB, 64-2000 px each side.
     * SVG is deliberately not accepted - logos are served same-origin from
     * /storage, and an SVG can carry script. Shared with UpdateBrandRequest.
     */
    public const LOGO_RULES = [
        'nullable',
        'image',
        'mimes:png,jpg,jpeg,webp',
        'max:2048',
        'dimensions:min_width=64,min_height=64,max_width=2000,max_height=2000',
    ];

    public function messages(): array
    {
        return [
            'logo.mimes' => 'The logo must be a PNG, JPG or WebP image.',
            'logo.max' => 'The logo must be 2 MB or smaller.',
            'logo.dimensions' => 'The logo must be between 64×64 and 2000×2000 pixels.',
        ];
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['required', 'string', 'max:100', 'alpha_dash', 'unique:vehicle_brands,slug'],
            'logo' => self::LOGO_RULES,
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
