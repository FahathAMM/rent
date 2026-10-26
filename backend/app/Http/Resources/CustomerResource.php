<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CustomerResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'email'         => $this->email,
            'phone'         => $this->phone,
            'status'        => $this->status,
            'avatar'        => $this->avatar ? asset(Storage::url($this->avatar)) : null,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'address'       => $this->address,
            'created_at'    => $this->created_at->toISOString(),
        ];
    }
}
