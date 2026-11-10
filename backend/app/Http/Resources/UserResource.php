<?php

namespace App\Http\Resources;

use App\Models\RentalShop;
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
            'roles'       => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()->all()),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->getAllPermissions()->pluck('name')->values()->all()),
            'shop'        => $this->whenLoaded('shop', fn () => $this->shop ? [
                'shop_id'   => $this->shop_id,
                'shop_name' => $this->shop->name,
                'slug'      => $this->shop->slug,
                'city'      => $this->shop->city,
                'logo'      => $this->shop->logo_url,
                'is_verified' => $this->shop->isVerified(),
                'is_suspended' => $this->shop->status === RentalShop::STATUS_SUSPENDED,
                'role'       => $this->shopRole(),
                'role_label' => $this->shopRoleLabel(),
            ] : null),
            'created_at'  => $this->created_at->toISOString(),
        ];
    }
}
