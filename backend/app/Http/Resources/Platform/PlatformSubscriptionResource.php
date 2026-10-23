<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

class PlatformSubscriptionResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'status'        => $this->status,
            'starts_at'     => $this->starts_at?->toISOString(),
            'trial_ends_at' => $this->trial_ends_at?->toISOString(),
            'ends_at'       => $this->ends_at?->toISOString(),
            'created_at'    => $this->created_at?->toISOString(),
            'company'       => $this->whenLoaded('company', fn () => [
                'id'   => $this->company->id,
                'name' => $this->company->name,
            ]),
            'plan'          => $this->whenLoaded('plan', fn () => [
                'id'   => $this->plan->id,
                'name' => $this->plan->name,
                'slug' => $this->plan->slug,
            ]),
        ];
    }
}
