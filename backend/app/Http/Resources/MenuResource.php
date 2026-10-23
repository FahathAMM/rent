<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'slug'       => $this->slug,
            'route_name' => $this->route_name,
            'icon'       => $this->icon,
            'parent_id'  => $this->parent_id,
            'parent'     => $this->when($this->relationLoaded('parent') && $this->parent, [
                'id'   => $this->parent?->id,
                'name' => $this->parent?->name,
            ]),
            'sort_order' => $this->sort_order,
            'is_active'  => $this->is_active,
            'children'   => MenuResource::collection($this->whenLoaded('children')),
        ];
    }
}
