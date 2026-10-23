<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

/** Platform admin view - the full financial breakdown, for oversight and reconciliation. */
class BookingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'booking_reference' => $this->booking_reference,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'shop' => $this->whenLoaded('vehicle.shop', fn () => [
                'id' => $this->vehicle->shop->id,
                'name' => $this->vehicle->shop->name,
            ]),
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'email' => $this->customer->email,
            ]),
            'vehicle_id' => $this->vehicle_id,
            'pickup_at' => $this->pickup_at->toISOString(),
            'return_at' => $this->return_at->toISOString(),
            'financials' => $this->whenLoaded('financials'),
            'has_open_dispute' => $this->has_open_dispute,
            'internal_note' => $this->internal_note,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
