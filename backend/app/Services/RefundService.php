<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\LedgerEntry;
use App\Models\Refund;
use App\Models\SystemAdmin;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Manual refund settlement — PayHere's refund API is unconfirmed against
 * a live merchant account (see app-doc/marketplace/06-plan-and-risks.md
 * "PayHere capability assumptions"), so this records a refund decision
 * and its evidence rather than calling a gateway. complete() is the
 * single enforcement point for "never mark a refund settled without
 * evidence", mirroring PayoutService::markPaid().
 */
class RefundService
{
    public function create(Booking $booking, array $data): Refund
    {
        $paid = (float) ($booking->financials?->customer_paid_amount ?? $booking->pricing?->total_payable ?? 0);
        $alreadyRefunded = (float) ($booking->financials?->refunded_amount ?? 0);

        if ($paid > 0 && ($alreadyRefunded + (float) $data['amount']) > $paid) {
            throw ValidationException::withMessages(['amount' => ['This would refund more than the customer ever paid.']]);
        }

        return Refund::create($data + [
            'booking_id' => $booking->id,
            'refund_reference' => 'RFD-' . Str::upper(Str::random(10)),
            'currency' => $booking->pricing?->currency ?? 'LKR',
            'status' => Refund::STATUS_REQUESTED,
            'requested_by' => $booking->customer_id,
        ]);
    }

    public function approve(SystemAdmin $admin, Refund $refund): Refund
    {
        if ($refund->status !== Refund::STATUS_REQUESTED) {
            throw ValidationException::withMessages(['status' => ['Only a requested refund can be approved.']]);
        }

        $refund->update([
            'status' => Refund::STATUS_APPROVED,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        return $refund->fresh();
    }

    public function reject(SystemAdmin $admin, Refund $refund, string $reason): Refund
    {
        if (in_array($refund->status, [Refund::STATUS_COMPLETED, Refund::STATUS_REJECTED], true)) {
            throw ValidationException::withMessages(['status' => ['This refund can no longer be rejected.']]);
        }

        $refund->update([
            'status' => Refund::STATUS_REJECTED,
            'approved_by' => $admin->id,
            'notes' => $reason,
        ]);

        return $refund->fresh();
    }

    public function complete(SystemAdmin $admin, Refund $refund, array $evidence): Refund
    {
        if ($refund->status !== Refund::STATUS_APPROVED) {
            throw ValidationException::withMessages(['status' => ['Only an approved refund can be marked complete.']]);
        }

        return DB::transaction(function () use ($refund, $evidence) {
            $refund->update([
                'status' => Refund::STATUS_COMPLETED,
                'gateway_refund_id' => $evidence['gateway_refund_id'] ?? null,
                'evidence_reference' => $evidence['evidence_reference'] ?? null,
                'notes' => $evidence['notes'] ?? $refund->notes,
                'processed_at' => now(),
            ]);

            $booking = $refund->booking;
            $financials = $booking->financials;

            if ($financials) {
                $newRefunded = (float) $financials->refunded_amount + (float) $refund->amount;
                $financials->update(['refunded_amount' => $newRefunded]);

                $paid = (float) $financials->customer_paid_amount;
                $booking->update([
                    'payment_status' => $newRefunded >= $paid ? Booking::PAYMENT_REFUNDED : Booking::PAYMENT_PARTIALLY_REFUNDED,
                ]);
            }

            $this->writeLedgerEntries($refund, $booking);

            return $refund->fresh();
        });
    }

    /**
     * A refund balances exactly like the confirmation entries do — cash
     * leaving platform_cash (a credit, mirroring the "Gateway fee paid"
     * line in TransitionBooking::writeLedgerEntries) against the
     * liability it settles. Deliberately does not reverse the original
     * commission_income/customer_receivable entries from confirmation —
     * those are a separate recorded event; the reconciliation report
     * shows both so a human can net them, consistent with "corrections
     * are new reversing entries, never edits to an existing row."
     */
    private function writeLedgerEntries(Refund $refund, Booking $booking): void
    {
        $batchId = (string) Str::uuid();
        $common = [
            'entry_date' => now()->toDateString(), 'currency' => $refund->currency,
            'booking_id' => $booking->id, 'shop_id' => $booking->shop_id,
            'refund_id' => $refund->id, 'payment_id' => $refund->payment_id,
            'batch_id' => $batchId,
        ];

        LedgerEntry::create([
            'account' => LedgerEntry::ACCOUNT_REFUNDS_PAYABLE, 'direction' => LedgerEntry::DEBIT,
            'amount' => $refund->amount, 'memo' => "Refund issued ({$refund->type})",
        ] + $common);

        LedgerEntry::create([
            'account' => LedgerEntry::ACCOUNT_PLATFORM_CASH, 'direction' => LedgerEntry::CREDIT,
            'amount' => $refund->amount, 'memo' => 'Cash paid out for refund',
        ] + $common);
    }
}
