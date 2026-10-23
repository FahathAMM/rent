<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

class PlatformCompanyDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        $sub = $this->latestSubscription;

        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'legal_name'     => $this->legal_name,
            'email'          => $this->email,
            'phone'          => $this->phone,
            'website'        => $this->website,
            'trn'            => $this->trn,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'city'           => $this->city,
            'emirate'        => $this->emirate,
            'country'        => $this->country,
            'currency'       => $this->currency,
            'status'         => $this->status,
            'created_at'     => $this->created_at?->toISOString(),
            'stats'          => $this->stats ?? null,
            'subscription'   => $sub ? [
                'id'            => $sub->id,
                'plan'          => $sub->plan?->name,
                'plan_slug'     => $sub->plan?->slug,
                'status'        => $sub->status,
                'starts_at'     => $sub->starts_at?->toISOString(),
                'trial_ends_at' => $sub->trial_ends_at?->toISOString(),
                'ends_at'       => $sub->ends_at?->toISOString(),
            ] : null,
        ];
    }
}
