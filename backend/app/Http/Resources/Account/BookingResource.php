<?php

namespace App\Http\Resources\Account;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The customer's own view of their booking - a fourth shape distinct
 * from Vendor/Platform (see app-doc/marketplace/05-ui-and-api-map.md
 * "Response-shaping rule"): full price breakdown and the vehicle's
 * registration_number (needed at pickup), but nothing about the shop's
 * commission, payouts or any other customer's booking.
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
                'slug' => $this->vehicle->slug,
                'registration_number' => $this->vehicle->registration_number,
                'make' => $this->vehicle->make,
                'model' => $this->vehicle->model,
            ]),
            'shop' => $this->whenLoaded('shop', fn () => [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'phone' => $this->shop->phone,
            ]),
            'pickup_location' => $this->whenLoaded('pickupLocation'),
            'return_location' => $this->whenLoaded('returnLocation'),
            'pickup_at' => $this->pickup_at->toISOString(),
            'return_at' => $this->return_at->toISOString(),
            'rental_days' => $this->rental_days,
            'with_driver' => $this->with_driver,
            'pricing' => $this->whenLoaded('pricing', fn () => [
                'currency' => $this->pricing->currency,
                'base_amount' => $this->pricing->base_amount,
                'extras_amount' => $this->pricing->extras_amount,
                'delivery_amount' => $this->pricing->delivery_amount,
                'driver_amount' => $this->pricing->driver_amount,
                'discount_amount' => $this->pricing->discount_amount,
                'subtotal' => $this->pricing->subtotal,
                'tax_amount' => $this->pricing->tax_amount,
                'security_deposit' => $this->pricing->security_deposit,
                'total_payable' => $this->pricing->total_payable,
            ]),
            'customer_note' => $this->customer_note,
            'cancellation_reason' => $this->cancellation_reason,
            'review_eligible_until' => $this->review_eligible_until?->toISOString(),
            'has_open_dispute' => $this->has_open_dispute,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
