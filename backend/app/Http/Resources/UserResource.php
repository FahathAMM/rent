<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'email'       => $this->email,
            'phone'       => $this->phone,
            'status'      => $this->status,
            'avatar'      => $this->avatar ? asset(Storage::url($this->avatar)) : null,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'address'     => $this->address,
            'roles'       => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()->all()),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->getAllPermissions()->pluck('name')->values()->all()),
            'shops'       => $this->whenLoaded('activeShopMemberships', fn () => $this->activeShopMemberships->map(fn ($m) => [
                'shop_id'   => $m->shop_id,
                'shop_name' => $m->shop?->name,
                'role'      => $m->role,
            ])->values()->all()),
            'created_at'  => $this->created_at->toISOString(),
        ];
    }
}
