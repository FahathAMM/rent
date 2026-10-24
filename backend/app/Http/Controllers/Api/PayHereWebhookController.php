<?php

namespace App\Http\Controllers\Api;

use App\Actions\TransitionBooking;
use App\Contracts\PaymentGateway;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Services\CommissionResolver;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * PayHere's server-to-server notification - public, unauthenticated, no
 * CSRF (this is an api.php route, which never has the web CSRF
 * middleware group applied). Follows
 * app-doc/marketplace/04-lifecycles.md "Payment lifecycle" steps 1-6
 * exactly; see that doc for why each step exists. ALWAYS returns 200 on
 * a handled event - never leak detail, and PayHere retries on anything
 * else.
 *
 * No auth guard is ever resolved for this route, so ShopScope's "no
 * guard at all -> unrestricted" branch applies when $payment->booking is
 * loaded below - the one place in the codebase that's true by having no
 * identity whatsoever, not by an explicit bypass.
 */
class PayHereWebhookController extends Controller
{
    public function __construct(
        private PaymentGateway $gateway,
        private TransitionBooking $transitions,
        private CommissionResolver $resolver,
    ) {}

    public function handle(Request $request): Response
    {
        $payload = $request->all();

        // Step 1: idempotency IS the insert - PayHere has no documented
        // unique event id, so order_id+status_code stands in for one: a
        // given order can only legitimately post the same status_code
        // once, and a retried notification has identical values.
        $eventId = ($payload['order_id'] ?? 'unknown') . '-' . ($payload['status_code'] ?? 'unknown');

        try {
            $event = PaymentWebhookEvent::create([
                'gateway' => 'payhere',
                'event_id' => $eventId,
                'event_type' => 'notify',
                'signature_valid' => false,
                'payload' => $payload,
                'received_at' => now(),
                'status' => 'received',
                'ip' => $request->ip(),
            ]);
        } catch (UniqueConstraintViolationException) {
            return response('OK', 200);
        }

        // Step 2: verify BEFORE trusting anything else in the payload.
        $valid = $this->gateway->verifyWebhookSignature($payload);
        $event->update(['signature_valid' => $valid]);
        if (!$valid) {
            $event->update(['status' => 'ignored', 'error' => 'Invalid signature']);
            return response('OK', 200);
        }

        $payment = DB::transaction(function () use ($payload, $event) {
            // Step 3: lock the payment row by order_id.
            $payment = Payment::where('payment_reference', $payload['order_id'] ?? '')->lockForUpdate()->first();
            if (!$payment) {
                $event->update(['status' => 'failed', 'error' => 'Unknown order_id']);
                return null;
            }
            $event->update(['payment_id' => $payment->id]);

            // Step 4: amount/currency re-asserted against what WE quoted -
            // never trust the payload's own figures as proof of anything.
            $amountMatches = round((float) ($payload['payhere_amount'] ?? 0), 2) === round((float) $payment->amount, 2);
            $currencyMatches = ($payload['payhere_currency'] ?? null) === $payment->currency;

            if (!$amountMatches || !$currencyMatches) {
                $payment->update([
                    'status' => Payment::STATUS_FAILED,
                    'failed_at' => now(),
                    'failure_reason' => 'Amount/currency mismatch against booking_pricing.total_payable',
                    'raw_response' => $payload,
                ]);
                $event->update(['status' => 'failed', 'error' => 'Amount/currency mismatch']);
                return null;
            }

            $payment->update([
                'gateway_order_id' => $payload['order_id'] ?? null,
                'gateway_payment_id' => $payload['payment_id'] ?? null,
                'gateway_status_code' => (string) ($payload['status_code'] ?? ''),
                'method' => $this->mapMethod($payload['method'] ?? null),
                'raw_response' => $payload,
            ]);

            // Step 5: status_code mapping.
            match ((string) ($payload['status_code'] ?? '')) {
                '2' => $payment->update(['status' => Payment::STATUS_SUCCEEDED, 'paid_at' => now()]),
                '0' => $payment->update(['status' => Payment::STATUS_PENDING]),
                '-1' => $payment->update(['status' => Payment::STATUS_CANCELLED]),
                '-2' => $payment->update(['status' => Payment::STATUS_FAILED, 'failed_at' => now(), 'failure_reason' => 'Gateway reported failure']),
                '-3' => $payment->update(['status' => Payment::STATUS_CHARGEBACK]),
                default => null,
            };

            return $payment->fresh();
        });

        if (!$payment) {
            return response('OK', 200);
        }

        // Step 6: confirm the booking (same transaction as the ledger
        // writes, inside TransitionBooking::confirm) and mark processed.
        if ($payment->status === Payment::STATUS_SUCCEEDED) {
            $this->transitions->confirm($payment->booking, $payment, $this->resolver);
        } elseif ($payment->status === Payment::STATUS_FAILED) {
            $payment->booking->update(['payment_status' => Booking::PAYMENT_FAILED]);
        }

        $event->update(['status' => 'processed', 'processed_at' => now()]);

        return response('OK', 200);
    }

    private function mapMethod(?string $payhereMethod): ?string
    {
        return match ($payhereMethod) {
            'VISA' => 'visa',
            'MASTER' => 'mastercard',
            'AMEX' => 'amex',
            'EZCASH' => 'ezcash',
            'MCASH' => 'mcash',
            'GENIE' => 'genie',
            default => $payhereMethod ? 'other' : null,
        };
    }
}
