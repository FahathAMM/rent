<?php

namespace App\Http\Resources\Vendor;

use App\Models\Payment;
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
            'payment_method' => $this->payment_method,
            'vehicle' => $this->whenLoaded('vehicle', fn () => [
                'id' => $this->vehicle->id,
                'title' => $this->vehicle->title,
                'slug' => $this->vehicle->slug,
                'registration_number' => $this->vehicle->registration_number,
                'make' => $this->vehicle->make,
                'model' => $this->vehicle->model,
                'year' => $this->vehicle->year,
                'transmission' => $this->vehicle->transmission,
                'fuel_type' => $this->vehicle->fuel_type,
                'seating_capacity' => $this->vehicle->seating_capacity,
                // Only the detail endpoint loads images (primary only).
                'images' => $this->vehicle->relationLoaded('images') ? $this->vehicle->images : [],
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
            'pricing' => $this->whenLoaded('pricing', fn () => $this->pricing ? [
                'currency' => $this->pricing->currency,
                'rate_plan' => $this->pricing->rate_plan,
                'base_amount' => $this->pricing->base_amount,
                'driver_amount' => $this->pricing->driver_amount,
                'delivery_amount' => $this->pricing->delivery_amount,
                'extras_amount' => $this->pricing->extras_amount,
                'weekend_surcharge_amount' => $this->pricing->weekend_surcharge_amount,
                'discount_amount' => $this->pricing->discount_amount,
                'tax_amount' => $this->pricing->tax_amount,
                'service_fee' => $this->pricing->service_fee,
                'subtotal' => $this->pricing->subtotal,
                'total_payable' => $this->pricing->total_payable,
                'security_deposit' => $this->pricing->security_deposit,
            ] : null),
            'security_deposit' => $this->whenLoaded('securityDeposit'),
            // The booking's statement, oldest first: charge, adjustments and money lines with the running balance.
            'payments' => $this->whenLoaded('payments', fn () => Payment::statementOrder($this->payments)->map->summary()->values()),
            'amount_paid' => $this->whenLoaded('payments', fn () => $this->amountPaid()),
            'balance_due' => $this->whenLoaded('payments', fn () => $this->balanceDue()),
            'inspections' => $this->whenLoaded('inspections'),
            'damages' => $this->whenLoaded('damages'),
            'status_histories' => $this->whenLoaded('statusHistories', fn () => $this->statusHistories->map(fn ($h) => [
                'id' => $h->id, 'field' => $h->field, 'from_value' => $h->from_value, 'to_value' => $h->to_value,
                'actor_type' => $h->actor_type, 'reason' => $h->reason, 'created_at' => $h->created_at?->toISOString(),
            ])),
            'delivery_requested' => $this->delivery_requested,
            'pickup_address' => $this->pickup_address,
            'actual_pickup_at' => $this->actual_pickup_at?->toISOString(),
            'actual_return_at' => $this->actual_return_at?->toISOString(),
            'accepted_at' => $this->accepted_at?->toISOString(),
            'confirmed_at' => $this->confirmed_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'cancelled_at' => $this->cancelled_at?->toISOString(),
            'rejection_reason' => $this->rejection_reason,
            'cancellation_reason' => $this->cancellation_reason,
            'customer_note' => $this->customer_note,
            'owner_note' => $this->owner_note,
            'has_open_dispute' => $this->has_open_dispute,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
