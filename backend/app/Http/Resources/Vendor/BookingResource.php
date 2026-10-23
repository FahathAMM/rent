<?php

namespace App\Http\Resources\Vendor;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The shop's view - everything needed to act on the booking, including
 * the customer's contact details (learned only through this booking),
 * but never the platform's commission/fee breakdown or any other shop's
 * data.
 */
class BookingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'booking_reference' => $this->booking_reference,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'vehicle' => $this->whenLoaded('vehicle', fn () => [
                'id' => $this->vehicle->id,
                'title' => $this->vehicle->title,
                'registration_number' => $this->vehicle->registration_number,
            ]),
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
                'email' => $this->customer->email,
            ]),
            'pickup_location' => $this->whenLoaded('pickupLocation'),
            'return_location' => $this->whenLoaded('returnLocation'),
            'pickup_at' => $this->pickup_at->toISOString(),
            'return_at' => $this->return_at->toISOString(),
            'rental_days' => $this->rental_days,
            'with_driver' => $this->with_driver,
            'owner_response_deadline_at' => $this->owner_response_deadline_at?->toISOString(),
            'payment_deadline_at' => $this->payment_deadline_at?->toISOString(),
            'pricing' => $this->whenLoaded('pricing', fn () => [
                'currency' => $this->pricing->currency,
                'total_payable' => $this->pricing->total_payable,
                'security_deposit' => $this->pricing->security_deposit,
            ]),
            'owner_payable_amount' => $this->whenLoaded('financials', fn () => $this->financials?->owner_payable_amount),
            'settlement_status' => $this->whenLoaded('financials', fn () => $this->financials?->settlement_status),
            'customer_note' => $this->customer_note,
            'owner_note' => $this->owner_note,
            'has_open_dispute' => $this->has_open_dispute,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
