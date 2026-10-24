<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\LedgerEntry;
use App\Models\OwnerPayout;
use App\Models\Payment;
use App\Models\Refund;
use Carbon\Carbon;

/**
 * "Gateway vs ledger vs payouts" — app-doc/marketplace/05-ui-and-api-
 * map.md's /platform/reconciliation. Three independently-written sources
 * (PaymentService, TransitionBooking::writeLedgerEntries, PayoutService)
 * should agree; this surfaces it when they don't rather than assuming
 * the double-entry construction alone is enough — a missing
 * booking_financials row or an unbalanced batch would mean something
 * wrote one side of a transaction without the other, which should never
 * happen but is exactly the kind of bug this report exists to catch.
 */
class ReconciliationService
{
    public function summary(?string $from, ?string $to): array
    {
        $from = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(30)->startOfDay();
        $to = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();

        $gatewayReceived = Payment::where('status', Payment::STATUS_SUCCEEDED)
            ->whereBetween('paid_at', [$from, $to])->sum('amount');

        $ledgerCashIn = LedgerEntry::where('account', LedgerEntry::ACCOUNT_PLATFORM_CASH)
            ->where('direction', LedgerEntry::DEBIT)->whereBetween('entry_date', [$from, $to])->sum('amount');

        $commissionIncome = LedgerEntry::where('account', LedgerEntry::ACCOUNT_COMMISSION_INCOME)
            ->where('direction', LedgerEntry::CREDIT)->whereBetween('entry_date', [$from, $to])->sum('amount');

        $ownerPayableAccrued = LedgerEntry::where('account', LedgerEntry::ACCOUNT_OWNER_PAYABLE)
            ->where('direction', LedgerEntry::CREDIT)->whereBetween('entry_date', [$from, $to])->sum('amount');

        $depositsHeld = LedgerEntry::where('account', LedgerEntry::ACCOUNT_DEPOSIT_LIABILITY)
            ->where('direction', LedgerEntry::CREDIT)->whereBetween('entry_date', [$from, $to])->sum('amount');

        $payoutsPaid = OwnerPayout::where('status', OwnerPayout::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to])->sum('net_amount');

        $refundsPaid = Refund::where('status', Refund::STATUS_COMPLETED)
            ->whereBetween('processed_at', [$from, $to])->sum('amount');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'gateway' => ['received' => round((float) $gatewayReceived, 2)],
            'ledger' => [
                'cash_in' => round((float) $ledgerCashIn, 2),
                'commission_income' => round((float) $commissionIncome, 2),
                'owner_payable_accrued' => round((float) $ownerPayableAccrued, 2),
                'deposits_held' => round((float) $depositsHeld, 2),
            ],
            'payouts' => ['paid' => round((float) $payoutsPaid, 2)],
            'refunds' => ['paid' => round((float) $refundsPaid, 2)],
            'discrepancies' => $this->findDiscrepancies($from, $to),
        ];
    }

    private function findDiscrepancies(Carbon $from, Carbon $to): array
    {
        $unbalancedBatches = LedgerEntry::selectRaw('batch_id, SUM(CASE WHEN direction = ? THEN amount ELSE -amount END) as diff', [LedgerEntry::DEBIT])
            ->whereBetween('entry_date', [$from, $to])
            ->whereNotNull('batch_id')
            ->groupBy('batch_id')
            ->havingRaw('ABS(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END)) > 0.01', [LedgerEntry::DEBIT])
            ->pluck('batch_id');

        $confirmedWithoutFinancials = Booking::whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED])
            ->whereDoesntHave('financials')
            ->whereBetween('confirmed_at', [$from, $to])
            ->pluck('booking_reference');

        $succeededPaymentsWithoutFinancials = Payment::where('status', Payment::STATUS_SUCCEEDED)
            ->whereBetween('paid_at', [$from, $to])
            ->whereDoesntHave('booking.financials')
            ->pluck('payment_reference');

        // A booking_financials row with zero ledger entries means
        // something wrote the settlement view without ever writing the
        // double-entry set TransitionBooking::confirm() normally writes
        // in the same transaction — real money (or a figure standing in
        // for it) exists on one side of the books but not the other.
        $financialsWithoutLedgerEntries = Booking::whereHas('financials')
            ->whereBetween('confirmed_at', [$from, $to])
            ->get(['id', 'booking_reference'])
            ->filter(fn ($b) => !LedgerEntry::where('booking_id', $b->id)->exists())
            ->pluck('booking_reference')
            ->values();

        return [
            'unbalanced_ledger_batches' => $unbalancedBatches->values(),
            'confirmed_bookings_without_financials' => $confirmedWithoutFinancials->values(),
            'succeeded_payments_without_financials' => $succeededPaymentsWithoutFinancials->values(),
            'bookings_with_financials_but_no_ledger_entries' => $financialsWithoutLedgerEntries,
        ];
    }

    /** Raw ledger rows for the period, for the CSV export. */
    public function ledgerRows(?string $from, ?string $to): \Illuminate\Support\Collection
    {
        $from = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(30)->startOfDay();
        $to = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();

        return LedgerEntry::with('booking:id,booking_reference')
            ->whereBetween('entry_date', [$from, $to])
            ->orderBy('entry_date')
            ->orderBy('batch_id')
            ->get();
    }
}
