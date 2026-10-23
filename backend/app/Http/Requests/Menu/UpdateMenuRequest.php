<?php

namespace App\Http\Requests\Menu;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMenuRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $menu = $this->route('menu');
        $id = $menu?->id;
        $audience = $this->input('audience', $menu?->audience);

        return [
            'audience'   => 'sometimes|required|in:customer,vendor,platform',
            'name'       => 'sometimes|required|string|max:100',
            'slug'       => [
                'sometimes', 'required', 'string', 'max:100', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('menus', 'slug')->where('audience', $audience)->ignore($id),
            ],
            'route_name' => 'nullable|string|max:200',
            'icon'       => 'nullable|string|max:100',
            'parent_id'  => "nullable|exists:menus,id|not_in:{$id}",
            'sort_order' => 'nullable|integer|min:0',
            'is_active'  => 'boolean',
        ];
    }
}
