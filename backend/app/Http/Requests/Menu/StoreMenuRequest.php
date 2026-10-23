<?php

namespace App\Http\Requests\Menu;

use Illuminate\Foundation\Http\FormRequest;

class StoreMenuRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'        => 'required|string|max:100',
            'slug'        => 'required|string|max:100|unique:menus,slug|regex:/^[a-z0-9_]+$/',
            'route_name'  => 'nullable|string|max:200',
            'icon'        => 'nullable|string|max:100',
            'parent_id'   => 'nullable|exists:menus,id',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'Slug may only contain lowercase letters, numbers, and underscores.',
        ];
    }
}
