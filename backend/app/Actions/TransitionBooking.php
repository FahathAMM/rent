<?php

namespace App\Actions;

use App\Models\Booking;
use App\Models\BookingDamage;
use App\Models\BookingFinancial;
use App\Models\BookingInspection;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\PlatformSetting;
use App\Models\ReservationHold;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Notifications\MarketplaceNotification;
use App\Services\CommissionResolver;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The single place a booking's status (or payment_status) is ever
 * written - see app-doc/marketplace/04-lifecycles.md: "Every transition
 * is executed by a single TransitionBooking action that writes a
 * booking_status_histories row... Controllers never set status
 * directly." Confirmation (accepted -> confirmed, via the payment
 * webhook) is a later phase; this covers every transition reachable
 * without PayHere wired up.
 */
class TransitionBooking
{
    /**
     * pending -> accepted. Re-validates overlap/holds/blocked-dates under
     * a row lock on the vehicle - the exact guarded block from
     * 04-lifecycles.md "Concurrency" - then opens the reservation hold
     * that protects the vehicle until payment_deadline_at.
     */
    public function accept(Booking $booking, int $actorId, int $paymentWindowHours): Booking
    {
        if ($booking->status !== Booking::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This request is no longer pending.']]);
        }
        if ($booking->owner_response_deadline_at && now()->greaterThan($booking->owner_response_deadline_at)) {
            throw ValidationException::withMessages(['status' => ['The response window for this request has passed.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $paymentWindowHours) {
            $vehicle = Vehicle::whereKey($booking->vehicle_id)->lockForUpdate()->firstOrFail();

            $this->assertNoOverlap($vehicle->id, $booking->pickup_at, $booking->return_at, $booking->id);

            $paymentDeadline = now()->addHours($paymentWindowHours)->min($booking->pickup_at->copy()->subHours(2));

            $booking->update([
                'status' => Booking::STATUS_ACCEPTED,
                'accepted_at' => now(),
                'decided_by' => $actorId,
                'payment_deadline_at' => $paymentDeadline,
            ]);

            ReservationHold::create([
                'vehicle_id' => $vehicle->id,
                'booking_id' => $booking->id,
                'user_id' => $booking->customer_id,
                'start_date' => $booking->pickup_at->toDateString(),
                'end_date' => $booking->return_at->toDateString(),
                'expires_at' => $paymentDeadline,
                'status' => ReservationHold::STATUS_ACTIVE,
                'reason' => 'accepted_awaiting_payment',
            ]);

            $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_ACCEPTED, 'staff', $actorId);

            $this->notifyCustomer($booking, 'booking_accepted', 'Booking accepted', "Your request for {$booking->vehicle->title} was accepted — complete payment to confirm it.", "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    /** pending -> rejected. */
    public function reject(Booking $booking, int $actorId, string $reason): Booking
    {
        if ($booking->status !== Booking::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This request is no longer pending.']]);
        }

        $booking->update([
            'status' => Booking::STATUS_REJECTED,
            'rejected_at' => now(),
            'rejection_reason' => $reason,
            'decided_by' => $actorId,
        ]);

        $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_REJECTED, 'staff', $actorId, $reason);

        $this->notifyCustomer($booking, 'booking_rejected', 'Booking declined', "Your request for {$booking->vehicle->title} was declined: {$reason}", "/account/bookings/{$booking->booking_reference}");

        return $booking->fresh();
    }

    /** pending|accepted -> cancelled_by_customer. Free - nothing has been paid in either state. */
    public function cancelByCustomer(Booking $booking, int $actorId, ?string $reason = null): Booking
    {
        if (!in_array($booking->status, [Booking::STATUS_PENDING, Booking::STATUS_ACCEPTED], true)) {
            throw ValidationException::withMessages(['status' => ['This booking can no longer be cancelled.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $reason) {
            $from = $booking->status;

            $booking->update([
                'status' => Booking::STATUS_CANCELLED_BY_CUSTOMER,
                'cancelled_at' => now(),
                'cancelled_by_type' => 'customer',
                'cancelled_by_id' => $actorId,
                'cancellation_reason' => $reason,
            ]);

            $this->releaseHold($booking);
            $this->history($booking, $from, Booking::STATUS_CANCELLED_BY_CUSTOMER, 'customer', $actorId, $reason);

            $this->notifyShopOwner($booking, 'booking_cancelled', 'Booking cancelled by customer', "The booking for {$booking->vehicle->title} ({$booking->booking_reference}) was cancelled by the customer.", '/vendor/bookings');

            return $booking->fresh();
        });
    }

    /** accepted -> cancelled_by_owner. The vehicle became unavailable after accepting but before payment. */
    public function cancelByOwner(Booking $booking, int $actorId, string $reason): Booking
    {
        if ($booking->status !== Booking::STATUS_ACCEPTED) {
            throw ValidationException::withMessages(['status' => ['Only an accepted-but-unpaid booking can be cancelled this way.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $reason) {
            $booking->update([
                'status' => Booking::STATUS_CANCELLED_BY_OWNER,
                'cancelled_at' => now(),
                'cancelled_by_type' => 'owner',
                'cancelled_by_id' => $actorId,
                'cancellation_reason' => $reason,
            ]);

            $this->releaseHold($booking);
            $this->history($booking, Booking::STATUS_ACCEPTED, Booking::STATUS_CANCELLED_BY_OWNER, 'staff', $actorId, $reason);

            $this->notifyCustomer($booking, 'booking_cancelled', 'Booking cancelled', "Your booking for {$booking->vehicle->title} was cancelled by the owner: {$reason}", "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    /** pending -> expired. Applied by the bookings:expire-unanswered sweep when now() > owner_response_deadline_at. */
    public function expireUnanswered(Booking $booking): Booking
    {
        $booking->update([
            'status' => Booking::STATUS_EXPIRED,
            'expired_at' => now(),
            'expiry_reason' => 'owner_no_response',
        ]);

        $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_EXPIRED, 'system', null, 'owner_no_response');

        $this->notifyCustomer($booking, 'booking_expired', 'Request expired', "The owner didn't respond to your request for {$booking->vehicle->title} in time, so it has expired.", '/account/bookings');

        return $booking->fresh();
    }

    /** accepted -> expired. Applied by the bookings:expire-unpaid sweep when now() > payment_deadline_at and still unpaid. */
    public function expireUnpaid(Booking $booking): Booking
    {
        return DB::transaction(function () use ($booking) {
            $booking->update([
                'status' => Booking::STATUS_EXPIRED,
                'expired_at' => now(),
                'expiry_reason' => 'payment_timeout',
            ]);

            $this->releaseHold($booking, ReservationHold::STATUS_EXPIRED);
            $this->history($booking, Booking::STATUS_ACCEPTED, Booking::STATUS_EXPIRED, 'system', null, 'payment_timeout');

            $this->notifyCustomer($booking, 'booking_expired', 'Payment window expired', "The payment window for your booking of {$booking->vehicle->title} has passed, so it has expired.", '/account/bookings');

            return $booking->fresh();
        });
    }

    /**
     * accepted -> confirmed. The ONLY caller is the PayHere webhook
     * handler, after it has already verified the signature, locked the
     * payment row, and asserted amount/currency match
     * booking_pricing.total_payable — see
     * app-doc/marketplace/04-lifecycles.md "Payment lifecycle" steps 3-5.
     * Idempotent: a replayed webhook that somehow reaches this (it
     * shouldn't — PaymentWebhookEvent's unique constraint catches replays
     * first) finds the booking already confirmed and returns it as-is
     * rather than double-writing financials/ledger/availability.
     */
    public function confirm(Booking $booking, Payment $payment, CommissionResolver $resolver): Booking
    {
        if ($booking->status === Booking::STATUS_CONFIRMED) {
            return $booking;
        }
        if ($booking->status !== Booking::STATUS_ACCEPTED) {
            throw ValidationException::withMessages(['status' => ['Only an accepted booking can be confirmed.']]);
        }

        return DB::transaction(function () use ($booking, $payment, $resolver) {
            $vehicle = Vehicle::whereKey($booking->vehicle_id)->lockForUpdate()->firstOrFail();

            $this->assertNoOverlap($vehicle->id, $booking->pickup_at, $booking->return_at, $booking->id);

            $booking->update([
                'status' => Booking::STATUS_CONFIRMED,
                'confirmed_at' => now(),
                'payment_status' => Booking::PAYMENT_PAID,
            ]);

            $this->releaseHold($booking, ReservationHold::STATUS_CONSUMED);
            $this->writeAvailability($vehicle->id, $booking);
            $this->writeFinancials($booking, $vehicle, $payment, $resolver);
            $this->writeSecurityDeposit($booking, $vehicle);

            $this->history($booking, Booking::STATUS_ACCEPTED, Booking::STATUS_CONFIRMED, 'system', null);

            $this->notifyCustomer($booking, 'booking_confirmed', 'Booking confirmed', "Payment received — your booking for {$booking->vehicle->title} is confirmed.", "/account/bookings/{$booking->booking_reference}");
            $this->notifyShopOwner($booking, 'booking_confirmed', 'Booking confirmed', "Payment received for {$booking->vehicle->title} ({$booking->booking_reference}) — the booking is now confirmed.", '/vendor/bookings');

            return $booking->fresh();
        });
    }

    /** One vehicle_availability row per rental day — unique(vehicle_id, date) is the hard backstop against double booking. */
    private function writeAvailability(int $vehicleId, Booking $booking): void
    {
        $rows = [];
        $cursor = $booking->pickup_at->copy()->startOfDay();
        $end = $booking->return_at->copy()->startOfDay();

        while ($cursor->lessThan($end)) {
            $rows[] = [
                'vehicle_id' => $vehicleId,
                'date' => $cursor->toDateString(),
                'status' => VehicleAvailability::STATUS_BOOKED,
                'booking_id' => $booking->id,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            $cursor->addDay();
        }

        VehicleAvailability::insert($rows);
    }

    /**
     * Commission resolved and frozen NOW, at confirmation — see
     * app-doc/marketplace/04-lifecycles.md "Commission model": editing or
     * deleting the rule later never re-prices this booking. Writes
     * booking_financials (the settlement view) and the 8-line ledger
     * entry set from the worked example in that same doc.
     */
    private function writeFinancials(Booking $booking, Vehicle $vehicle, Payment $payment, CommissionResolver $resolver): void
    {
        $pricing = $booking->pricing;
        $rule = $resolver->resolveFor($vehicle);

        $computed = $rule
            ? $resolver->compute($rule, (float) $pricing->base_amount, (float) $pricing->extras_amount, (float) $pricing->delivery_amount, (float) $pricing->driver_amount)
            : ['commissionable' => (float) $pricing->base_amount, 'commission' => 0.0];

        $processingFeeBorneBy = $rule?->processing_fee_borne_by ?? 'platform';
        $gatewayFee = round((float) $payment->amount * (float) config('services.payhere.fee_percentage') / 100, 2);
        $ownerFeeShare = match ($processingFeeBorneBy) {
            'owner' => $gatewayFee,
            'split' => round($gatewayFee / 2, 2),
            default => 0.0,
        };
        $platformFeeShare = $gatewayFee - $ownerFeeShare;

        $ownerPayable = round($computed['commissionable'] - $computed['commission'] - $ownerFeeShare, 2);
        $platformNet = round($computed['commission'] - $platformFeeShare, 2);

        BookingFinancial::create([
            'booking_id' => $booking->id,
            'currency' => $pricing->currency,
            'customer_paid_amount' => $payment->amount,
            'security_deposit_held' => (float) ($pricing->pricing_snapshot['security_deposit'] ?? 0),
            'gross_rental_amount' => $pricing->base_amount,
            'commissionable_amount' => $computed['commissionable'],
            'commission_rule_id' => $rule?->id,
            'commission_rate' => $rule?->percentage,
            'commission_fixed' => $rule?->fixed_amount,
            'commission_amount' => $computed['commission'],
            'payment_processing_fee' => $gatewayFee,
            'processing_fee_borne_by' => $processingFeeBorneBy === 'split' ? 'platform' : $processingFeeBorneBy,
            'owner_payable_amount' => $ownerPayable,
            'platform_net_amount' => $platformNet,
            'settlement_status' => BookingFinancial::SETTLEMENT_NOT_ELIGIBLE,
        ]);

        $this->writeLedgerEntries($booking, $payment, $pricing, $computed, $platformFeeShare, $ownerPayable);
    }

    /**
     * The 8-line entry set from app-doc/marketplace/04-lifecycles.md
     * "Ledger entries at confirmation" verbatim. Deposits post to
     * deposit_liability, never to revenue - see the same doc's "Security
     * deposit" section.
     */
    private function writeLedgerEntries(Booking $booking, Payment $payment, BookingPricing $pricing, array $computed, float $platformFeeShare, float $ownerPayable): void
    {
        $batchId = (string) Str::uuid();
        $today = now()->toDateString();
        $depositHeld = (float) ($pricing->pricing_snapshot['security_deposit'] ?? 0);
        $common = [
            'entry_date' => $today, 'currency' => $pricing->currency,
            'booking_id' => $booking->id, 'shop_id' => $booking->shop_id, 'payment_id' => $payment->id,
            'batch_id' => $batchId,
        ];

        $entries = [
            ['account' => LedgerEntry::ACCOUNT_PLATFORM_CASH, 'direction' => LedgerEntry::DEBIT, 'amount' => $payment->amount, 'memo' => 'Cash received'],
            ['account' => LedgerEntry::ACCOUNT_CUSTOMER_RECEIVABLE, 'direction' => LedgerEntry::CREDIT, 'amount' => $computed['commissionable'], 'memo' => 'Rental revenue recognised'],
        ];
        if ($depositHeld > 0 && ($pricing->pricing_snapshot['deposit_method'] ?? null) === 'prepaid') {
            $entries[] = ['account' => LedgerEntry::ACCOUNT_DEPOSIT_LIABILITY, 'direction' => LedgerEntry::CREDIT, 'amount' => $depositHeld, 'memo' => 'Deposit held — not revenue'];
        }
        if ($platformFeeShare > 0) {
            $entries[] = ['account' => LedgerEntry::ACCOUNT_GATEWAY_FEES, 'direction' => LedgerEntry::DEBIT, 'amount' => $platformFeeShare, 'memo' => 'Gateway fee'];
            $entries[] = ['account' => LedgerEntry::ACCOUNT_PLATFORM_CASH, 'direction' => LedgerEntry::CREDIT, 'amount' => $platformFeeShare, 'memo' => 'Gateway fee paid'];
        }
        $entries[] = ['account' => LedgerEntry::ACCOUNT_COMMISSION_INCOME, 'direction' => LedgerEntry::CREDIT, 'amount' => $computed['commission'], 'memo' => 'Platform commission'];
        $entries[] = ['account' => LedgerEntry::ACCOUNT_CUSTOMER_RECEIVABLE, 'direction' => LedgerEntry::DEBIT, 'amount' => $computed['commission'], 'memo' => 'Commission out of rental revenue'];
        $entries[] = ['account' => LedgerEntry::ACCOUNT_OWNER_PAYABLE, 'direction' => LedgerEntry::CREDIT, 'amount' => $ownerPayable, 'memo' => 'Accrues — not yet payout-eligible'];
        $entries[] = ['account' => LedgerEntry::ACCOUNT_CUSTOMER_RECEIVABLE, 'direction' => LedgerEntry::DEBIT, 'amount' => $ownerPayable, 'memo' => 'Owner payable recognised'];

        foreach ($entries as $entry) {
            LedgerEntry::create($entry + $common);
        }
    }

    private function writeSecurityDeposit(Booking $booking, Vehicle $vehicle): void
    {
        $pricing = $booking->pricing;
        $depositMethod = $pricing->pricing_snapshot['deposit_method'] ?? $vehicle->pricing?->deposit_method ?? 'cash_on_pickup';
        $required = (float) ($pricing->pricing_snapshot['security_deposit'] ?? 0);
        $isPrepaid = $depositMethod === 'prepaid' && $required > 0;

        SecurityDeposit::create([
            'booking_id' => $booking->id,
            'amount_required' => $required,
            'amount_collected' => $isPrepaid ? $required : 0,
            'hold_method' => $depositMethod,
            'status' => $isPrepaid ? SecurityDeposit::STATUS_HELD : SecurityDeposit::STATUS_PENDING,
            'collected_at' => $isPrepaid ? now() : null,
        ]);
    }

    /**
     * confirmed -> active. "Not before pickup_at - grace" per
     * app-doc/marketplace/04-lifecycles.md - no grace setting is defined
     * anywhere else in the schema for this specific check, so this reuses
     * the same 2-hour buffer TransitionBooking::accept() already applies
     * to the payment deadline cap, rather than inventing a new config key
     * for a single call site.
     */
    public function handover(Booking $booking, int $actorId, array $inspection): Booking
    {
        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            throw ValidationException::withMessages(['status' => ['Only a confirmed booking can be handed over.']]);
        }
        if (now()->lessThan($booking->pickup_at->copy()->subHours(2))) {
            throw ValidationException::withMessages(['status' => ['Too early for handover — check back closer to the pickup time.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $inspection) {
            BookingInspection::create($inspection + [
                'booking_id' => $booking->id,
                'type' => BookingInspection::TYPE_HANDOVER,
                'conducted_by' => $actorId,
                'conducted_at' => now(),
            ]);

            $booking->update([
                'status' => Booking::STATUS_ACTIVE,
                'actual_pickup_at' => now(),
            ]);

            $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, 'staff', $actorId);

            return $booking->fresh();
        });
    }

    /**
     * active -> completed. Records the return inspection and any damages,
     * then opens the review window and sets the payout-eligibility date -
     * see app-doc/marketplace/04-lifecycles.md "owner_payable accrues at
     * confirmation but becomes payout-eligible only once completed and
     * past payout_dispute_window_days". settlement_status flips to
     * 'unsettled' right away (there is nothing left to wait on but the
     * dispute window itself); payouts:build-cycle is the one that checks
     * eligible_for_payout_at against now() before actually including it.
     */
    public function returnVehicle(Booking $booking, int $actorId, array $inspection, array $damages = []): Booking
    {
        if ($booking->status !== Booking::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['status' => ['Only an active booking can be returned.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $inspection, $damages) {
            $returnInspection = BookingInspection::create($inspection + [
                'booking_id' => $booking->id,
                'type' => BookingInspection::TYPE_RETURN,
                'conducted_by' => $actorId,
                'conducted_at' => now(),
            ]);

            foreach ($damages as $damage) {
                BookingDamage::create($damage + [
                    'booking_id' => $booking->id,
                    'inspection_id' => $returnInspection->id,
                    'status' => 'reported',
                    'reported_by' => $actorId,
                ]);
            }

            $now = now();
            $disputeWindowDays = (int) PlatformSetting::get('payout_dispute_window_days', 3);

            $booking->update([
                'status' => Booking::STATUS_COMPLETED,
                'actual_return_at' => $now,
                'completed_at' => $now,
                'review_eligible_until' => $now->copy()->addDays(14),
            ]);

            $booking->vehicle()->increment('booking_count');
            $booking->vehicle()->update(['last_booked_at' => $now]);

            $booking->financials?->update([
                'settlement_status' => BookingFinancial::SETTLEMENT_UNSETTLED,
                'eligible_for_payout_at' => $now->copy()->addDays($disputeWindowDays),
            ]);

            $this->history($booking, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED, 'staff', $actorId);

            $this->notifyCustomer($booking, 'booking_completed', 'Trip completed', "Your rental of {$booking->vehicle->title} is complete — share your experience with a review.", "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    /** confirmed -> no_show. Applied by a sweep when now() > pickup_at + no_show_grace_hours and the booking never reached handover. */
    public function noShow(Booking $booking): Booking
    {
        $booking->update(['status' => Booking::STATUS_NO_SHOW]);

        $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_NO_SHOW, 'system', null);

        return $booking->fresh();
    }

    /**
     * The guarded block from 04-lifecycles.md "Concurrency" verbatim:
     * row lock already held by the caller on $vehicleId's vehicle row,
     * this re-validates against confirmed/active bookings, other active
     * holds, and blocked/maintenance availability rows.
     */
    private function assertNoOverlap(int $vehicleId, Carbon $pickupAt, Carbon $returnAt, ?int $ignoreBookingId): void
    {
        $overlap = Booking::where('vehicle_id', $vehicleId)
            ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
            ->where('pickup_at', '<', $returnAt)
            ->where('return_at', '>', $pickupAt)
            ->when($ignoreBookingId, fn ($q) => $q->whereKeyNot($ignoreBookingId))
            ->lockForUpdate()
            ->exists();
        abort_if($overlap, 409, 'Vehicle is no longer available for those dates.');

        $heldElsewhere = ReservationHold::where('vehicle_id', $vehicleId)
            ->where('status', ReservationHold::STATUS_ACTIVE)
            ->where('expires_at', '>', now())
            ->where('start_date', '<', $returnAt)
            ->where('end_date', '>', $pickupAt)
            ->when($ignoreBookingId, fn ($q) => $q->where('booking_id', '!=', $ignoreBookingId))
            ->exists();
        abort_if($heldElsewhere, 409, 'Vehicle is on hold for another request.');

        $blocked = VehicleAvailability::where('vehicle_id', $vehicleId)
            ->whereIn('status', [VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$pickupAt->toDateString(), $returnAt->copy()->subDay()->toDateString()])
            ->exists();
        abort_if($blocked, 409, 'Some of those dates are unavailable.');
    }

    private function releaseHold(Booking $booking, string $status = ReservationHold::STATUS_RELEASED): void
    {
        ReservationHold::where('booking_id', $booking->id)
            ->where('status', ReservationHold::STATUS_ACTIVE)
            ->update(['status' => $status]);
    }

    private function history(Booking $booking, ?string $from, string $to, string $actorType, ?int $actorId, ?string $reason = null): void
    {
        BookingStatusHistory::create([
            'booking_id' => $booking->id,
            'field' => 'status',
            'from_value' => $from,
            'to_value' => $to,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'reason' => $reason,
        ]);
    }

    private function notifyCustomer(Booking $booking, string $type, string $title, string $body, ?string $actionUrl = null): void
    {
        $booking->customer?->notify(new MarketplaceNotification($type, $title, $body, $actionUrl));
    }

    /** $booking->shop (a plain belongsTo, not BelongsToShop) needs no scope workaround — see Booking's own docblock on shop_id being denormalised for exactly this kind of read. */
    private function notifyShopOwner(Booking $booking, string $type, string $title, string $body, ?string $actionUrl = null): void
    {
        $booking->shop?->owner?->notify(new MarketplaceNotification($type, $title, $body, $actionUrl));
    }
}
