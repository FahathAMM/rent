<?php

namespace App\Http\Requests\Menu;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMenuRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = $this->route('menu')?->id;

        return [
            'name'       => 'sometimes|required|string|max:100',
            'slug'       => "sometimes|required|string|max:100|unique:menus,slug,{$id}|regex:/^[a-z0-9_]+$/",
            'route_name' => 'nullable|string|max:200',
            'icon'       => 'nullable|string|max:100',
            'parent_id'  => "nullable|exists:menus,id|not_in:{$id}",
            'sort_order' => 'nullable|integer|min:0',
            'is_active'  => 'boolean',
        ];
    }
}
