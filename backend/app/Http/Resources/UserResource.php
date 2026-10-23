<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;
use App\Http\Resources\CompanyResource;

class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                => $this->id,
            'company_id'        => $this->company_id,
            'company'           => new CompanyResource($this->whenLoaded('company')),
            'name'              => $this->name,
            'email'             => $this->email,
            'phone'             => $this->phone,
            'is_active'         => $this->is_active,
            'avatar'            => $this->avatar ? asset(Storage::url($this->avatar)) : null,
            'employee_id'       => $this->employee_id,
            'gender'            => $this->gender,
            'date_of_birth'     => $this->date_of_birth?->toDateString(),
            'joining_date'      => $this->joining_date?->toDateString(),
            'address'           => $this->address,
            'emergency_contact' => $this->emergency_contact,
            'roles'             => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()->all()),
            'permissions'       => $this->whenLoaded('permissions', fn () => $this->getAllPermissions()->pluck('name')->values()->all()),
            'created_at'        => $this->created_at->toISOString(),
        ];
    }
}
