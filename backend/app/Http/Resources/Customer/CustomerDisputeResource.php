<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Resources\Json\JsonResource;

class CustomerDisputeResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'dispute_reference' => $this->dispute_reference,
            'raised_by_side' => $this->raised_by_side,
            'against_side' => $this->against_side,
            'category' => $this->category,
            'subject' => $this->subject,
            'description' => $this->description,
            'claimed_amount' => $this->claimed_amount,
            'status' => $this->status,
            'resolution' => $this->resolution,
            'resolution_amount' => $this->resolution_amount,
            'resolution_in_favour_of' => $this->resolution_in_favour_of,
            'resolved_at' => $this->resolved_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'booking' => $this->whenLoaded('booking', fn () => [
                'booking_reference' => $this->booking->booking_reference,
                'pickup_at' => $this->booking->pickup_at?->toISOString(),
                'return_at' => $this->booking->return_at?->toISOString(),
                'shop' => $this->booking->relationLoaded('shop') && $this->booking->shop ? ['name' => $this->booking->shop->name] : null,
                'vehicle' => $this->booking->relationLoaded('vehicle') && $this->booking->vehicle ? ['title' => $this->booking->vehicle->title] : null,
            ]),
            'messages' => $this->whenLoaded('messages', fn () => $this->messages->map(fn ($message) => [
                'id' => $message->id,
                'author_type' => $message->author_type,
                'message' => $message->message,
                'created_at' => $message->created_at?->toISOString(),
            ])->values()),
        ];
    }
}
