<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CompanyResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'legal_name'      => $this->legal_name,
            'email'           => $this->email,
            'phone'           => $this->phone,
            'website'         => $this->website,
            'trn'             => $this->trn,
            'address_line_1'  => $this->address_line_1,
            'address_line_2'  => $this->address_line_2,
            'city'            => $this->city,
            'emirate'         => $this->emirate,
            'country'         => $this->country,
            'currency'        => $this->currency,
            'timezone'        => $this->timezone,
            'logo'            => $this->logo ? asset(Storage::url($this->logo)) : null,
            'status'          => $this->status,
            'created_at'      => $this->created_at?->toISOString(),
        ];
    }
}
