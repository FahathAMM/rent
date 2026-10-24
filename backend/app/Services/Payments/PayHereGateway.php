<?php

namespace App\Services\Payments;

use App\Contracts\PaymentGateway;
use App\Models\Booking;
use App\Models\Payment;

/**
 * PayHere's documented checkout-hash and notify-verification algorithms.
 * Neither has been exercised against a live/sandbox PayHere account in
 * this codebase yet - see app-doc/marketplace/06-plan-and-risks.md. Both
 * directions use the SAME merchant_secret, so they are internally
 * consistent regardless: a payload this class signs for checkout will
 * verify correctly through this class's own verifyWebhookSignature() once
 * PayHere echoes the same fields back, and the reverse is true for
 * testing - compute a notify payload with this algorithm and it verifies.
 */
class PayHereGateway implements PaymentGateway
{
    public function checkoutUrl(): string
    {
        return config('services.payhere.sandbox')
            ? 'https://sandbox.payhere.lk/pay/checkout'
            : 'https://www.payhere.lk/pay/checkout';
    }

    public function checkoutPayload(Payment $payment, Booking $booking): array
    {
        $merchantId = (string) config('services.payhere.merchant_id');
        $amount = number_format((float) $payment->amount, 2, '.', '');
        $currency = $payment->currency;

        $customer = $booking->customer;
        [$firstName, $lastName] = $this->splitName($customer?->name ?? 'Customer');

        return [
            'merchant_id' => $merchantId,
            'return_url' => rtrim((string) config('app.frontend_url'), '/') . "/account/bookings/{$booking->booking_reference}",
            'cancel_url' => rtrim((string) config('app.frontend_url'), '/') . "/account/bookings/{$booking->booking_reference}",
            'notify_url' => rtrim((string) config('app.url'), '/') . '/api/webhooks/payhere',
            'order_id' => $payment->payment_reference,
            'items' => "Booking {$booking->booking_reference}",
            'currency' => $currency,
            'amount' => $amount,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $customer?->email,
            'phone' => $customer?->phone,
            'address' => $booking->pickup_address ?? 'N/A',
            'city' => $booking->shop?->city ?? 'Colombo',
            'country' => 'Sri Lanka',
            'hash' => $this->checkoutHash($merchantId, $payment->payment_reference, $amount, $currency),
        ];
    }

    public function verifyWebhookSignature(array $payload): bool
    {
        $expected = $this->notifyHash(
            (string) ($payload['merchant_id'] ?? ''),
            (string) ($payload['order_id'] ?? ''),
            (string) ($payload['payhere_amount'] ?? ''),
            (string) ($payload['payhere_currency'] ?? ''),
            (string) ($payload['status_code'] ?? ''),
        );

        return hash_equals($expected, strtoupper((string) ($payload['md5sig'] ?? '')));
    }

    private function checkoutHash(string $merchantId, string $orderId, string $amount, string $currency): string
    {
        $secret = (string) config('services.payhere.merchant_secret');

        return strtoupper(md5($merchantId . $orderId . $amount . $currency . strtoupper(md5($secret))));
    }

    private function notifyHash(string $merchantId, string $orderId, string $payhereAmount, string $payhereCurrency, string $statusCode): string
    {
        $secret = (string) config('services.payhere.merchant_secret');

        return strtoupper(md5($merchantId . $orderId . $payhereAmount . $payhereCurrency . $statusCode . strtoupper(md5($secret))));
    }

    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2);

        return [$parts[0] ?? 'Customer', $parts[1] ?? ''];
    }
}
