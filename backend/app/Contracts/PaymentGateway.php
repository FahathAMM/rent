<?php

namespace App\Contracts;

use App\Models\Booking;
use App\Models\Payment;

/**
 * Gateway interaction sits behind this interface precisely because
 * PayHere's actual capabilities (refunds API, payment-retrieval API,
 * webhook retry policy) are unconfirmed against a live merchant account -
 * see app-doc/marketplace/06-plan-and-risks.md "PayHere capability
 * assumptions". A capability gap changes one driver, not the booking/
 * payment lifecycle built on top of it.
 */
interface PaymentGateway
{
    /** The hosted-checkout host to POST the payload to (sandbox or live). */
    public function checkoutUrl(): string;

    /**
     * Server-computed checkout fields, including the gateway's hash - the
     * amount always comes from $payment (itself built from
     * booking_pricing.total_payable), never from request input. See
     * app-doc/marketplace/04-lifecycles.md "Payment lifecycle" rule 1.
     *
     * @return array<string, mixed>
     */
    public function checkoutPayload(Payment $payment, Booking $booking): array;

    /**
     * Verifies a webhook notification's signature against the merchant
     * secret. Must be checked BEFORE trusting anything else in $payload -
     * see app-doc/marketplace/04-lifecycles.md "Payment lifecycle" step 2.
     *
     * @param array<string, mixed> $payload
     */
    public function verifyWebhookSignature(array $payload): bool;
}
