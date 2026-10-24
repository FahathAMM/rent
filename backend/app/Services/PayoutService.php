<?php

namespace App\Services;

use App\Models\BookingFinancial;
use App\Models\LedgerEntry;
use App\Models\OwnerPayout;
use App\Models\OwnerPayoutItem;
use App\Models\PayoutAdjustment;
use App\Models\PlatformSetting;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Notifications\MarketplaceNotification;
use App\Support\NumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manual settlement batches - see app-doc/marketplace/04-lifecycles.md
 * "Payout cycle". PayHere has no marketplace-split/sub-merchant payout
 * API, so platform-collects-then-settles is the only available design,
 * not a shortcut (see app-doc/marketplace/06-plan-and-risks.md).
 */
class PayoutService
{
    /**
     * Selects booking_financials where settlement_status=unsettled AND
     * booking.status=completed AND now() > eligible_for_payout_at AND NOT
     * booking.has_open_dispute, groups by shop, applies pending
     * payout_adjustments, and skips a shop whose net is below its
     * threshold (the items simply stay unsettled and are picked up again
     * next cycle - "carries forward").
     *
     * @return OwnerPayout[]
     */
    public function buildCycle(): array
    {
        $eligible = BookingFinancial::with('booking')
            ->where('settlement_status', BookingFinancial::SETTLEMENT_UNSETTLED)
            ->where('eligible_for_payout_at', '<=', now())
            ->whereHas('booking', fn ($q) => $q->where('status', 'completed')->where('has_open_dispute', false))
            ->get()
            ->groupBy(fn (BookingFinancial $bf) => $bf->booking->shop_id);

        $created = [];

        foreach ($eligible as $shopId => $financials) {
            $payout = $this->buildForShop((int) $shopId, $financials);
            if ($payout) {
                $created[] = $payout;
            }
        }

        return $created;
    }

    private function buildForShop(int $shopId, $financials): ?OwnerPayout
    {
        return DB::transaction(function () use ($shopId, $financials) {
            $shop = RentalShop::findOrFail($shopId);

            $adjustments = PayoutAdjustment::where('shop_id', $shopId)
                ->where('status', 'pending')
                ->get();
            $adjustmentsAmount = $adjustments->sum(fn ($a) => $a->direction === 'credit' ? (float) $a->amount : -(float) $a->amount);

            $grossRental = $financials->sum('gross_rental_amount');
            $commission = $financials->sum('commission_amount');
            $processingFee = $financials->sum('payment_processing_fee');
            $taxWithheld = $financials->sum('tax_withheld');
            $netAmount = round($financials->sum('owner_payable_amount') + $adjustmentsAmount, 2);

            $threshold = (float) ($shop->min_payout_threshold ?? PlatformSetting::get('min_payout_threshold', 5000));
            if ($netAmount < $threshold) {
                return null; // carries forward — items stay unsettled for the next cycle
            }

            $completedDates = $financials->map(fn ($bf) => $bf->booking->completed_at)->filter();

            $payout = OwnerPayout::create([
                'payout_reference' => NumberGenerator::next($shopId, 'payout'),
                'shop_id' => $shopId,
                'period_start' => $completedDates->min()?->toDateString() ?? now()->toDateString(),
                'period_end' => $completedDates->max()?->toDateString() ?? now()->toDateString(),
                'currency' => $financials->first()->currency,
                'gross_rental_amount' => $grossRental,
                'commission_amount' => $commission,
                'processing_fee_amount' => $processingFee,
                'tax_withheld_amount' => $taxWithheld,
                'adjustments_amount' => $adjustmentsAmount,
                'net_amount' => $netAmount,
                'booking_count' => $financials->count(),
                'status' => OwnerPayout::STATUS_PENDING_APPROVAL,
                'payout_method' => 'bank_transfer',
                'bank_detail_id' => $shop->primaryBankDetail?->id,
            ]);

            foreach ($financials as $bf) {
                OwnerPayoutItem::create([
                    'payout_id' => $payout->id,
                    'booking_id' => $bf->booking_id,
                    'financial_snapshot' => $bf->toArray(),
                    'gross_amount' => $bf->gross_rental_amount,
                    'commission_amount' => $bf->commission_amount,
                    'processing_fee_amount' => $bf->payment_processing_fee,
                    'net_amount' => $bf->owner_payable_amount,
                ]);

                $bf->update(['settlement_status' => BookingFinancial::SETTLEMENT_IN_PAYOUT, 'payout_id' => $payout->id]);
            }

            foreach ($adjustments as $adjustment) {
                $adjustment->update(['status' => 'applied', 'applied_at' => now(), 'payout_id' => $payout->id]);
            }

            return $payout;
        });
    }

    public function approve(SystemAdmin $admin, OwnerPayout $payout): OwnerPayout
    {
        if ($payout->status !== OwnerPayout::STATUS_PENDING_APPROVAL) {
            throw ValidationException::withMessages(['status' => ['Only a pending-approval payout can be approved.']]);
        }

        $payout->update([
            'status' => OwnerPayout::STATUS_APPROVED,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        AuditService::edit('OwnerPayout', $payout->id, $payout->payout_reference, null, ['status' => 'approved', 'decided_by_admin_id' => $admin->id]);

        return $payout->fresh();
    }

    public function markProcessing(SystemAdmin $admin, OwnerPayout $payout): OwnerPayout
    {
        if ($payout->status !== OwnerPayout::STATUS_APPROVED) {
            throw ValidationException::withMessages(['status' => ['Only an approved payout can move to processing.']]);
        }

        $payout->update(['status' => OwnerPayout::STATUS_PROCESSING]);

        AuditService::edit('OwnerPayout', $payout->id, $payout->payout_reference, null, ['status' => 'processing', 'decided_by_admin_id' => $admin->id]);

        return $payout->fresh();
    }

    /**
     * The state machine refuses `paid` without settlement evidence -
     * "Never mark a payout complete until verified evidence of
     * settlement is recorded" — see
     * app-doc/marketplace/04-lifecycles.md "Payout cycle" guardrails.
     */
    public function markPaid(SystemAdmin $admin, OwnerPayout $payout, ?int $evidenceAttachmentId, ?string $evidenceReference): OwnerPayout
    {
        if (!in_array($payout->status, [OwnerPayout::STATUS_APPROVED, OwnerPayout::STATUS_PROCESSING], true)) {
            throw ValidationException::withMessages(['status' => ['Only an approved or processing payout can be marked paid.']]);
        }
        if (!$evidenceAttachmentId && !$evidenceReference) {
            throw ValidationException::withMessages(['evidence' => ['Settlement evidence (an attachment or a bank reference) is required to mark a payout paid.']]);
        }

        return DB::transaction(function () use ($admin, $payout, $evidenceAttachmentId, $evidenceReference) {
            $payout->update([
                'status' => OwnerPayout::STATUS_PAID,
                'paid_by' => $admin->id,
                'paid_at' => now(),
                'evidence_attachment_id' => $evidenceAttachmentId,
                'evidence_reference' => $evidenceReference,
                'evidence_recorded_at' => now(),
            ]);

            $payout->items()->get()->each(function (OwnerPayoutItem $item) {
                $item->booking->financials?->update(['settlement_status' => BookingFinancial::SETTLEMENT_PAID]);
            });

            $this->writePaidLedgerEntry($payout);

            AuditService::edit('OwnerPayout', $payout->id, $payout->payout_reference, null, ['status' => 'paid', 'decided_by_admin_id' => $admin->id]);

            $payout->shop?->owner?->notify(new MarketplaceNotification(
                'payout_paid', 'Payout paid', "Your payout {$payout->payout_reference} for " . number_format((float) $payout->net_amount, 2) . " LKR has been settled.", '/vendor/finance/payouts',
            ));

            return $payout->fresh();
        });
    }

    public function markFailed(SystemAdmin $admin, OwnerPayout $payout, string $reason): OwnerPayout
    {
        if (!in_array($payout->status, [OwnerPayout::STATUS_APPROVED, OwnerPayout::STATUS_PROCESSING], true)) {
            throw ValidationException::withMessages(['status' => ['Only an approved or processing payout can be marked failed.']]);
        }

        return DB::transaction(function () use ($admin, $payout, $reason) {
            $payout->update(['status' => OwnerPayout::STATUS_FAILED, 'failure_reason' => $reason]);

            // Items released back to the pool — see "Payout cycle" guardrails.
            $payout->items()->get()->each(function (OwnerPayoutItem $item) {
                $item->booking->financials?->update(['settlement_status' => BookingFinancial::SETTLEMENT_UNSETTLED, 'payout_id' => null]);
            });

            PayoutAdjustment::where('payout_id', $payout->id)->update(['status' => 'pending', 'payout_id' => null]);

            AuditService::edit('OwnerPayout', $payout->id, $payout->payout_reference, null, ['status' => 'failed', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

            return $payout->fresh();
        });
    }

    /** DEBIT owner_payable / CREDIT platform_cash — see "Payout cycle" guardrails. */
    private function writePaidLedgerEntry(OwnerPayout $payout): void
    {
        $common = [
            'entry_date' => now()->toDateString(),
            'amount' => $payout->net_amount,
            'currency' => $payout->currency,
            'shop_id' => $payout->shop_id,
            'payout_id' => $payout->id,
            'memo' => "Payout {$payout->payout_reference} paid",
        ];

        LedgerEntry::create($common + ['account' => LedgerEntry::ACCOUNT_OWNER_PAYABLE, 'direction' => LedgerEntry::DEBIT]);
        LedgerEntry::create($common + ['account' => LedgerEntry::ACCOUNT_PLATFORM_CASH, 'direction' => LedgerEntry::CREDIT]);
    }
}
