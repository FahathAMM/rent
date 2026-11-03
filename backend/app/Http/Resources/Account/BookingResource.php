<?php

namespace App\Http\Resources\Account;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\BankTransferService;
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
            'payment_method' => $this->payment_method,
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
                'slug' => $this->shop->slug,
                'phone' => $this->shop->phone,
                // The shop's own terms - cancellation/refunds on a paid-to-shop booking follow these.
                'policies' => $this->shop->policies ?? [],
            ]),
            // Where to transfer - only to this customer, only once the booking is confirmed and still open.
            'bank_details' => $this->when(
                $this->payment_method === Booking::METHOD_BANK_TRANSFER
                    && in_array($this->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE], true)
                    && $this->relationLoaded('shop') && $this->shop->primaryBankDetail,
                fn () => [
                    'account_holder_name' => $this->shop->primaryBankDetail->account_holder_name,
                    'bank_name' => $this->shop->primaryBankDetail->bank_name,
                    'branch_name' => $this->shop->primaryBankDetail->branch_name,
                    'account_number' => $this->shop->primaryBankDetail->account_number,
                ],
            ),
            // Every payment on the booking (their uploads, ones the shop recorded, cash at pickup).
            // The booking's statement, oldest first: charge, adjustments and money lines with the running balance.
            'payments' => $this->whenLoaded('payments', fn () => Payment::statementOrder($this->payments)->map->summary()->values()),
            'amount_paid' => $this->whenLoaded('payments', fn () => $this->amountPaid()),
            'balance_due' => $this->whenLoaded('payments', fn () => $this->balanceDue()),
            // Shop terms signed by the customer at handover (RentalAgreementService).
            'agreement' => app(\App\Services\RentalAgreementService::class)->status($this->resource),
            // Next transfer: quick picks (advance / full, then the balance) and the least they may type in.
            'transfer_options' => $this->when(
                $this->payment_method === Booking::METHOD_BANK_TRANSFER && $this->relationLoaded('pricing'),
                fn () => app(BankTransferService::class)->transferOptions($this->resource),
            ),
            'minimum_transfer' => $this->when(
                $this->payment_method === Booking::METHOD_BANK_TRANSFER && $this->relationLoaded('pricing'),
                fn () => app(BankTransferService::class)->minimumTransfer($this->resource),
            ),
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
            // The shop moved the dates: from/to are the old and new "pickup → return" ranges (display timezone).
            'date_changes' => $this->whenLoaded('dateChanges', fn () => $this->dateChanges->map(fn ($h) => [
                'from' => $h->from_value,
                'to' => $h->to_value,
                'reason' => $h->reason,
                'changed_at' => $h->created_at?->toISOString(),
            ])->values()),
            'review' => $this->whenLoaded('review', fn () => $this->review ? [
                'id' => $this->review->id,
                'rating' => $this->review->rating,
                'status' => $this->review->status,
            ] : null),
            'has_open_dispute' => $this->has_open_dispute,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
