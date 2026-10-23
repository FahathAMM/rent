<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'slug'           => $this->slug,
            'monthly_price'  => (float) $this->monthly_price,
            'yearly_price'   => $this->yearly_price !== null ? (float) $this->yearly_price : null,
            'max_users'      => $this->max_users,
            'max_customers'  => $this->max_customers,
            'max_invoices'   => $this->max_invoices,
            'trial_days'     => $this->trial_days,
            'status'         => $this->status,
            'sort_order'     => $this->sort_order,
            'disabled_modules' => $this->disabled_modules ?? [],
            'subscriptions_count' => $this->subscriptions_count ?? null,
            'created_at'     => $this->created_at?->toISOString(),
        ];
    }
}
