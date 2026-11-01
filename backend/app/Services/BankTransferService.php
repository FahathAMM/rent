<?php

namespace App\Services;

use App\Models\Attachment;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
use App\Models\Payment;
use App\Notifications\MarketplaceNotification;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Bank transfer straight to the shop's account. The customer uploads a
 * receipt (-> a 'pending' bank_transfer payment); only the shop, after
 * checking its own bank statement, turns it into money received. A
 * receipt on its own never marks a booking paid - a screenshot proves
 * nothing. The platform never holds this money, so there are no
 * financials/ledger rows (same as cash).
 */
class BankTransferService
{
    /** Receipts are private: served only through the permission-checked proof routes, never a public URL. */
    public const PROOF_DISK = 'local';

    public function submit(Booking $booking, Customer $customer, float $amount, ?string $reference, UploadedFile $file): Payment
    {
        if ($booking->payment_method !== Booking::METHOD_BANK_TRANSFER || $booking->status !== Booking::STATUS_CONFIRMED) {
            throw ValidationException::withMessages(['status' => ['Transfers can only be added to a confirmed bank-transfer booking.']]);
        }
        if ($booking->payments()->where('status', Payment::STATUS_PENDING)->exists()) {
            throw ValidationException::withMessages(['amount' => ['Your last transfer is still waiting for the shop to check it.']]);
        }

        $amount = round($amount, 2);
        $balance = $booking->balanceDue();
        $minimum = $this->minimumTransfer($booking);
        if ($amount > $balance) {
            throw ValidationException::withMessages(['amount' => ['The amount is more than the balance due (' . number_format($balance, 2) . ').']]);
        }
        if ($amount < $minimum) {
            throw ValidationException::withMessages(['amount' => [$minimum >= $balance
                ? 'This shop takes the full amount by transfer — please transfer ' . number_format($balance, 2) . '.'
                : 'The first transfer must be at least the advance of ' . number_format($minimum, 2) . '.']]);
        }

        return DB::transaction(function () use ($booking, $customer, $amount, $reference, $file) {
            $payment = Payment::create([
                'booking_id' => $booking->id,
                'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
                'method' => Payment::METHOD_BANK,
                'type' => $booking->amountPaid() > 0 ? 'balance' : 'rental',
                'credit' => $amount,
                'currency' => $booking->pricing->currency,
                'status' => Payment::STATUS_PENDING,
                'transfer_reference' => $reference,
                'idempotency_key' => (string) Str::uuid(),
                'initiated_by' => $customer->id,
            ]);

            $this->storeProof($booking, $payment, $file);

            $booking->shop?->owner?->notify(new MarketplaceNotification(
                'transfer_submitted', 'Bank transfer to check',
                "The customer uploaded a transfer receipt for {$booking->booking_reference} — check your bank account and verify it.",
                "/vendor/bookings/{$booking->booking_reference}",
            ));

            return $payment;
        });
    }

    /**
     * A payment the shop itself received - cash before pickup, a transfer the
     * customer never uploaded, etc. The shop is the one confirming receipt,
     * so it is recorded as succeeded straight away (no review step); the
     * receipt is optional. Never more than the balance due.
     */
    public function recordByShop(Booking $booking, int $actorId, string $method, float $amount, ?string $paidAt, ?string $reference, ?UploadedFile $file): Payment
    {
        if (!$booking->isPaidToShop() || !in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE], true)) {
            throw ValidationException::withMessages(['status' => ['Payments can only be recorded on an open cash or bank-transfer booking.']]);
        }

        $amount = round($amount, 2);
        $balance = $booking->balanceDue();
        if ($amount > $balance) {
            throw ValidationException::withMessages(['amount' => ['The amount is more than the balance due (' . number_format($balance, 2) . ').']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $method, $amount, $paidAt, $reference, $file) {
            $payment = Payment::create([
                'booking_id' => $booking->id,
                'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
                'method' => $method === Booking::METHOD_BANK_TRANSFER ? Payment::METHOD_BANK : Payment::METHOD_CASH,
                'type' => $booking->amountPaid() > 0 ? 'balance' : 'rental',
                'credit' => $amount,
                'currency' => $booking->pricing->currency,
                'status' => Payment::STATUS_SUCCEEDED,
                'transfer_reference' => $reference,
                'paid_at' => $paidAt ? Carbon::parse($paidAt) : now(),
                'verified_by' => $actorId,
                'verified_at' => now(),
                'idempotency_key' => (string) Str::uuid(),
                'initiated_by' => $booking->customer_id,
            ]);

            if ($file) {
                $this->storeProof($booking, $payment, $file);
            }
            $payment->settleBalance();

            $booking->unsetRelation('payments');
            $this->syncPaymentStatus($booking, $actorId, 'payment_recorded_by_shop');

            $this->notifyCustomer($booking, 'payment_recorded', 'Payment recorded',
                'The shop recorded a payment of ' . number_format($amount, 2) . " for {$booking->booking_reference}." . ($booking->balanceDue() > 0 ? '' : ' Your booking is fully paid.'));

            return $payment;
        });
    }

    public function verify(Booking $booking, Payment $payment, int $actorId): Payment
    {
        $this->assertReviewable($booking, $payment);
        // The shop may have recorded other payments meanwhile.
        if ((float) $payment->credit > $booking->balanceDue()) {
            throw ValidationException::withMessages(['status' => ['This transfer is more than the balance still due — reject it and ask the customer to upload the right amount.']]);
        }

        return DB::transaction(function () use ($booking, $payment, $actorId) {
            $payment->update([
                'status' => Payment::STATUS_SUCCEEDED,
                'paid_at' => now(),
                'verified_by' => $actorId,
                'verified_at' => now(),
            ]);
            $payment->settleBalance();

            $booking->unsetRelation('payments');
            $this->syncPaymentStatus($booking, $actorId);

            $this->notifyCustomer($booking, 'transfer_verified', 'Transfer received',
                "The shop confirmed your transfer for {$booking->booking_reference}." . ($booking->balanceDue() > 0 ? ' The rest is due at pickup.' : ' Your booking is fully paid.'));

            return $payment->fresh();
        });
    }

    public function reject(Booking $booking, Payment $payment, int $actorId, string $reason): Payment
    {
        $this->assertReviewable($booking, $payment);

        $payment->update([
            'status' => Payment::STATUS_FAILED,
            'verified_by' => $actorId,
            'verified_at' => now(),
        ]);

        $this->notifyCustomer($booking, 'transfer_rejected', 'Transfer not confirmed',
            "The shop couldn't confirm your transfer for {$booking->booking_reference}: {$reason}. You can upload a new receipt.");

        return $payment->fresh();
    }

    /**
     * Quick-pick amounts for the customer's upload form - they may also type
     * any amount between minimumTransfer() and the balance. First: the
     * shop's advance (advance_percentage of total_payable, default 5%) or
     * the full total; after that, the remaining balance.
     *
     * @return list<array{key: string, amount: float}>
     */
    public function transferOptions(Booking $booking): array
    {
        $balance = $booking->balanceDue();
        if ($balance <= 0) {
            return [];
        }
        if ($booking->amountPaid() > 0) {
            return [['key' => 'balance', 'amount' => $balance]];
        }

        $advance = $this->advanceAmount($booking);

        return $advance !== null && $advance > 0 && $advance < $balance
            ? [['key' => 'advance', 'amount' => $advance], ['key' => 'full', 'amount' => $balance]]
            : [['key' => 'full', 'amount' => $balance]];
    }

    /**
     * The least a transfer may be: the advance for the first one, or the full
     * amount when the shop set no advance; after that any amount (the rest
     * can also be paid in cash at pickup).
     */
    public function minimumTransfer(Booking $booking): float
    {
        $balance = $booking->balanceDue();
        if ($booking->amountPaid() > 0) {
            return min(1.0, $balance);
        }
        $advance = $this->advanceAmount($booking);

        return $advance !== null && $advance < $balance ? $advance : $balance;
    }

    /** advance_percentage of total_payable, rounded up to a whole unit so the customer transfers a clean figure. */
    public function advanceAmount(Booking $booking): ?float
    {
        $percentage = $booking->shop?->advance_percentage;
        if ($percentage === null || (float) $percentage <= 0) {
            return null;
        }

        return (float) ceil((float) $booking->pricing->total_payable * (float) $percentage / 100);
    }

    private function assertReviewable(Booking $booking, Payment $payment): void
    {
        abort_unless($payment->booking_id === $booking->id && $payment->method === Payment::METHOD_BANK, 404);

        if ($payment->status !== Payment::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This transfer has already been reviewed.']]);
        }
        if (!in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE], true)) {
            throw ValidationException::withMessages(['status' => ['This booking is no longer open for payments.']]);
        }
    }

    private function storeProof(Booking $booking, Payment $payment, UploadedFile $file): void
    {
        $path = $file->store("transfer-proofs/{$booking->shop_id}/{$booking->id}", self::PROOF_DISK);
        Attachment::create([
            'shop_id' => $booking->shop_id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'disk' => self::PROOF_DISK,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'checksum' => hash_file('sha256', $file->getRealPath()),
            'attachable_type' => Payment::class,
            'attachable_id' => $payment->id,
            'document_type' => 'transfer_proof',
            'visibility' => 'restricted',
        ]);
    }

    /** unpaid -> partially_paid -> paid, from what the shop has actually received. */
    private function syncPaymentStatus(Booking $booking, int $actorId, string $reason = 'bank_transfer_verified'): void
    {
        $to = $booking->balanceDue() <= 0 ? Booking::PAYMENT_PAID : Booking::PAYMENT_PARTIALLY_PAID;
        $from = $booking->payment_status;
        if ($from === $to) {
            return;
        }

        $booking->update(['payment_status' => $to]);

        BookingStatusHistory::create([
            'booking_id' => $booking->id,
            'field' => 'payment_status',
            'from_value' => $from,
            'to_value' => $to,
            'actor_type' => 'staff',
            'actor_id' => $actorId,
            'reason' => $reason,
        ]);
    }

    private function notifyCustomer(Booking $booking, string $type, string $title, string $body): void
    {
        $booking->customer?->notify(new MarketplaceNotification($type, $title, $body, "/account/bookings/{$booking->booking_reference}"));
    }
}
