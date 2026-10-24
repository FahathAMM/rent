<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\Payment;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Starts a checkout - see app-doc/marketplace/04-lifecycles.md "Payment
 * lifecycle": "POST /bookings/{ref}/checkout -> gateway payload (amount
 * server-side only)". The amount always comes from booking_pricing.
 * total_payable, never from the request - there is no amount parameter
 * on this method at all.
 */
class PaymentService
{
    public function __construct(private PaymentGateway $gateway) {}

    public function startCheckout(Booking $booking): array
    {
        if ($booking->status !== Booking::STATUS_ACCEPTED) {
            throw ValidationException::withMessages(['status' => ['Only an accepted booking can be paid for.']]);
        }
        if (!in_array($booking->payment_status, [Booking::PAYMENT_UNPAID, Booking::PAYMENT_FAILED], true)) {
            throw ValidationException::withMessages(['status' => ['This booking has already been paid or is awaiting a pending payment.']]);
        }
        if ($booking->payment_deadline_at && now()->greaterThan($booking->payment_deadline_at)) {
            throw ValidationException::withMessages(['status' => ['The payment window for this booking has passed.']]);
        }

        $pricing = $booking->pricing;
        abort_unless($pricing, 422, 'This booking has no price quote.');

        $payment = Payment::create([
            'booking_id' => $booking->id,
            'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
            'gateway' => 'payhere',
            'type' => 'rental',
            'amount' => $pricing->total_payable,
            'currency' => $pricing->currency,
            'status' => Payment::STATUS_INITIATED,
            'idempotency_key' => (string) Str::uuid(),
            'initiated_by' => $booking->customer_id,
        ]);

        $fromPaymentStatus = $booking->payment_status;
        $booking->update(['payment_status' => Booking::PAYMENT_INITIATED]);

        BookingStatusHistory::create([
            'booking_id' => $booking->id,
            'field' => 'payment_status',
            'from_value' => $fromPaymentStatus,
            'to_value' => Booking::PAYMENT_INITIATED,
            'actor_type' => 'customer',
            'actor_id' => $booking->customer_id,
        ]);

        return [
            'url' => $this->gateway->checkoutUrl(),
            'fields' => $this->gateway->checkoutPayload($payment, $booking),
        ];
    }
}
