<?php

namespace App\Actions;

use App\Models\Booking;
use App\Models\BookingDamage;
use App\Models\BookingInspection;
use App\Models\BookingStatusHistory;
use App\Models\Payment;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehiclePricing;
use App\Notifications\MarketplaceNotification;
use App\Services\BookingPricingCalculator;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * The single place a booking's status (or payment_status) is ever
 * written - see app-doc/marketplace/04-lifecycles.md: "Every transition
 * is executed by a single TransitionBooking action that writes a
 * booking_status_histories row... Controllers never set status
 * directly."
 *
 * Bookings are paid to the shop directly (cash at pickup, or bank transfer
 * verified by the shop), so accepting a request confirms it straight away.
 * The online-payment flow (accepted -> awaiting payment -> confirmed by the
 * PayHere webhook, with commission, ledger and payouts) was removed - see
 * app-doc/marketplace/09-online-payments-archive.md to rebuild it.
 */
class TransitionBooking
{
    /**
     * pending -> confirmed. The customer pays the shop directly - cash at
     * pickup, or a bank transfer (advance or full, verified by the shop; see
     * BankTransferService) with any balance in cash at pickup - so there is
     * nothing to wait for: the dates are booked now under a row lock on the
     * vehicle (04-lifecycles.md "Concurrency"). No payment deadline: an
     * unpaid transfer booking simply stays confirmed.
     */
    public function accept(Booking $booking, int $actorId): Booking
    {
        if ($booking->status !== Booking::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This request is no longer pending.']]);
        }
        if ($booking->owner_response_deadline_at && now()->greaterThan($booking->owner_response_deadline_at)) {
            throw ValidationException::withMessages(['status' => ['The response window for this request has passed.']]);
        }

        $method = $booking->payment_method === Booking::METHOD_BANK_TRANSFER ? Booking::METHOD_BANK_TRANSFER : Booking::METHOD_CASH;

        return DB::transaction(function () use ($booking, $actorId, $method) {
            $vehicle = Vehicle::whereKey($booking->vehicle_id)->lockForUpdate()->firstOrFail();

            $this->assertNoOverlap($vehicle->id, $booking->pickup_at, $booking->return_at, $booking->id);

            $booking->update([
                'status' => Booking::STATUS_CONFIRMED,
                'payment_method' => $method,
                'payment_status' => Booking::PAYMENT_UNPAID,
                'accepted_at' => now(),
                'confirmed_at' => now(),
                'decided_by' => $actorId,
            ]);

            $this->writeAvailability($vehicle->id, $booking);
            $deposit = $this->writeSecurityDeposit($booking);
            // Opens the customer's statement: the rental (total_payable less the deposit) and the deposit as its own line.
            $depositRequired = (float) $deposit->amount_required;
            Payment::postLine($booking, Payment::TYPE_BOOKING_CHARGE, debit: (float) $booking->pricing->total_payable - $depositRequired, credit: 0, actorId: $actorId);
            if ($depositRequired > 0) {
                Payment::postLine($booking, Payment::TYPE_SECURITY_DEPOSIT, debit: $depositRequired, credit: 0, actorId: $actorId);
            }
            $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, 'staff', $actorId, $method === Booking::METHOD_CASH ? 'cash_on_pickup' : 'bank_transfer');

            $this->notifyCustomer($booking, 'booking_confirmed', 'Booking confirmed', $method === Booking::METHOD_CASH
                ? "Your booking for {$booking->vehicle->title} is confirmed — pay the shop in cash when you pick it up."
                : "Your booking for {$booking->vehicle->title} is confirmed — transfer the payment to the shop's bank account and upload the receipt.", "/account/bookings/{$booking->booking_reference}");

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

    /**
     * pending -> cancelled_by_customer, and a confirmed paid-to-shop
     * booking before handover while no money has gone to the shop. Once a
     * transfer is uploaded or verified, refunds follow the shop's own policy,
     * so the customer has to contact the shop instead.
     */
    public function cancelByCustomer(Booking $booking, int $actorId, ?string $reason = null): Booking
    {
        if ($booking->status === Booking::STATUS_CONFIRMED && $booking->isPaidToShop() && !$this->isUnpaidToShop($booking)) {
            throw ValidationException::withMessages(['status' => ['You have already paid the shop — contact them to cancel; refunds follow their policy.']]);
        }
        if ($booking->status !== Booking::STATUS_PENDING && !$this->isUnpaidToShop($booking)) {
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

            VehicleAvailability::where('vehicle_id', $booking->vehicle_id)->where('booking_id', $booking->id)->delete();
            $this->reverseCharges($booking, null);
            $this->history($booking, $from, Booking::STATUS_CANCELLED_BY_CUSTOMER, 'customer', $actorId, $reason);

            $this->notifyShopOwner($booking, 'booking_cancelled', 'Booking cancelled by customer', "The booking for {$booking->vehicle->title} ({$booking->booking_reference}) was cancelled by the customer.", '/vendor/bookings');

            return $booking->fresh();
        });
    }

    /**
     * confirmed -> cancelled_by_owner, before handover (e.g. the vehicle
     * became unavailable). If the customer already transferred money,
     * the shop refunds it directly under its own policy - the platform never
     * held it, so nothing is reversed here; pending receipts are closed.
     */
    public function cancelByOwner(Booking $booking, int $actorId, string $reason): Booking
    {
        if (!($booking->status === Booking::STATUS_CONFIRMED && $booking->isPaidToShop())) {
            throw ValidationException::withMessages(['status' => ['Only a confirmed booking that has not been handed over can be cancelled.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $reason) {
            $from = $booking->status;
            $booking->update([
                'status' => Booking::STATUS_CANCELLED_BY_OWNER,
                'cancelled_at' => now(),
                'cancelled_by_type' => 'owner',
                'cancelled_by_id' => $actorId,
                'cancellation_reason' => $reason,
            ]);

            VehicleAvailability::where('vehicle_id', $booking->vehicle_id)->where('booking_id', $booking->id)->delete();
            $this->reverseCharges($booking, $actorId);
            $booking->payments()->where('method', Payment::METHOD_BANK)->where('status', Payment::STATUS_PENDING)->update(['status' => Payment::STATUS_CANCELLED]);
            $this->history($booking, $from, Booking::STATUS_CANCELLED_BY_OWNER, 'staff', $actorId, $reason);

            $refundNote = $booking->amountPaid() > 0 ? ' Contact the shop about refunding what you paid — it follows their refund policy.' : '';
            $this->notifyCustomer($booking, 'booking_cancelled', 'Booking cancelled', "Your booking for {$booking->vehicle->title} was cancelled by the owner: {$reason}.{$refundNote}", "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    /**
     * Any pre-terminal state -> cancelled_by_admin. A platform override
     * for abuse/fraud/dispute situations that a customer or owner cannot
     * cancel themselves — e.g. an active booking. Deliberately does NOT
     * touch money: anything the customer paid went to the shop directly,
     * so any refund is between the shop and the customer.
     */
    public function cancelByAdmin(Booking $booking, int $adminId, string $reason): Booking
    {
        if (!in_array($booking->status, [
            Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE,
        ], true)) {
            throw ValidationException::withMessages(['status' => ['This booking can no longer be cancelled.']]);
        }

        return DB::transaction(function () use ($booking, $adminId, $reason) {
            $from = $booking->status;

            $booking->update([
                'status' => Booking::STATUS_CANCELLED_BY_ADMIN,
                'cancelled_at' => now(),
                'cancelled_by_type' => 'system_admin',
                'cancelled_by_id' => $adminId,
                'cancellation_reason' => $reason,
            ]);

            VehicleAvailability::where('vehicle_id', $booking->vehicle_id)->where('booking_id', $booking->id)->delete();
            $this->reverseCharges($booking, null);
            $this->history($booking, $from, Booking::STATUS_CANCELLED_BY_ADMIN, 'system_admin', $adminId, $reason);

            $this->notifyCustomer($booking, 'booking_cancelled', 'Booking cancelled', "Your booking for {$booking->vehicle->title} was cancelled by the platform: {$reason}", "/account/bookings/{$booking->booking_reference}");
            $this->notifyShopOwner($booking, 'booking_cancelled', 'Booking cancelled', "Booking {$booking->booking_reference} was cancelled by the platform: {$reason}", '/vendor/bookings');

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

    /** A confirmed paid-to-shop booking not yet handed over, with no transfer uploaded or received — it can still be cancelled for free. */
    /**
     * A booking that won't go ahead owes nothing any more: credit back the
     * charges still on its statement (booking charge + adjustments). Money
     * already received stays, so the balance goes negative - what the shop
     * holds for the customer, refunded (or kept) under the shop's policy.
     */
    private function reverseCharges(Booking $booking, ?int $actorId): void
    {
        $charged = (float) Payment::where('booking_id', $booking->id)
            ->whereNull('method')
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->selectRaw('COALESCE(SUM(debit - credit), 0) as net')
            ->value('net');

        if (round($charged, 2) > 0) {
            Payment::postLine($booking, Payment::TYPE_ADJUSTMENT, debit: 0, credit: $charged, actorId: $actorId);
        }
    }

    private function isUnpaidToShop(Booking $booking): bool
    {
        return $booking->status === Booking::STATUS_CONFIRMED
            && $booking->isPaidToShop()
            && $booking->payment_status === Booking::PAYMENT_UNPAID
            && !$booking->payments()->money()->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_SUCCEEDED])->exists();
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

    /** The deposit is taken by the shop at the counter (handover) - nothing is ever prepaid through the platform. */
    private function writeSecurityDeposit(Booking $booking): SecurityDeposit
    {
        $pricing = $booking->pricing;
        $waived = ($pricing->pricing_snapshot['deposit_method'] ?? null) === 'waived';
        $required = $waived ? 0.0 : (float) ($pricing->pricing_snapshot['security_deposit'] ?? 0);

        return SecurityDeposit::create([
            'booking_id' => $booking->id,
            'amount_required' => $required,
            'amount_collected' => 0,
            'hold_method' => $waived ? 'waived' : 'cash_on_pickup',
            'status' => SecurityDeposit::STATUS_PENDING,
        ]);
    }

    /**
     * confirmed -> active. "Not before pickup_at - grace" per
     * app-doc/marketplace/04-lifecycles.md - no grace setting is defined
     * anywhere else in the schema for this specific check, so this reuses
     * a fixed 2-hour buffer rather than inventing a new config key for a
     * single call site.
     */
    public function handover(Booking $booking, int $actorId, array $inspection, bool $cashReceived = false): Booking
    {
        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            throw ValidationException::withMessages(['status' => ['Only a confirmed booking can be handed over.']]);
        }

        //  throw ValidationException::withMessages(['status' => [$booking->pickup_at]]);
        
        if (now()->lessThan($booking->pickup_at->copy()->subHours(2))) {
            throw ValidationException::withMessages(['status' => ['Too early for handover — check back closer to the pickup time.']]);
        }

        $paidToShop = $booking->isPaidToShop();
        $deposit = $booking->securityDeposit;
        $depositDue = $deposit
            && $deposit->hold_method === 'cash_on_pickup'
            && $deposit->status === SecurityDeposit::STATUS_PENDING
            && (float) $deposit->amount_required > 0;

        if ($booking->payments()->where('method', Payment::METHOD_BANK)->where('status', Payment::STATUS_PENDING)->exists()) {
            throw ValidationException::withMessages(['status' => ["Verify or reject the customer's pending bank transfer before handing over."]]);
        }

        // Paid to the shop: total_payable (deposit included) less what the shop has already verified.
        $alreadyPaid = $paidToShop ? $booking->amountPaid() : 0.0;
        $cashDue = $paidToShop ? $booking->balanceDue() : 0.0;

        if (($cashDue > 0 || (!$paidToShop && $depositDue)) && !$cashReceived) {
            throw ValidationException::withMessages(['cash_received' => ['Confirm you have received the cash from the customer before handing over the vehicle.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $inspection, $paidToShop, $deposit, $depositDue, $alreadyPaid, $cashDue) {
            $depositAmount = $depositDue ? (float) $deposit->amount_required : 0.0;

            if ($paidToShop && $alreadyPaid > 0) {
                // Part (or all) came by bank transfer: whatever is left is one balance line.
                if ($cashDue > 0) {
                    $this->recordCashPayment($booking, 'balance', $cashDue);
                }
            } elseif ($paidToShop) {
                // All in cash now: split rental and deposit, since total_payable includes the deposit.
                $rentalAmount = max(0, round($cashDue - $depositAmount, 2));
                if ($rentalAmount > 0) {
                    $this->recordCashPayment($booking, 'rental', $rentalAmount);
                }
            }
            if ($depositDue) {
                if (!$paidToShop || $alreadyPaid <= 0) {
                    $this->recordCashPayment($booking, 'security_deposit', $depositAmount);
                }
                $deposit->update([
                    'amount_collected' => $depositAmount,
                    'status' => SecurityDeposit::STATUS_HELD,
                    'collected_at' => now(),
                ]);
            }

            BookingInspection::create($inspection + [
                'booking_id' => $booking->id,
                'type' => BookingInspection::TYPE_HANDOVER,
                'conducted_by' => $actorId,
                'conducted_at' => now(),
            ]);

            $fromPaymentStatus = $booking->payment_status;
            $booking->update([
                'status' => Booking::STATUS_ACTIVE,
                'actual_pickup_at' => now(),
                // Paid-to-shop bookings are settled in full at the counter, at handover.
                ...($paidToShop ? ['payment_status' => Booking::PAYMENT_PAID] : []),
            ]);

            $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, 'staff', $actorId);
            if ($paidToShop && $fromPaymentStatus !== Booking::PAYMENT_PAID) {
                $this->history($booking, $fromPaymentStatus, Booking::PAYMENT_PAID, 'staff', $actorId, $cashDue > 0 ? 'cash_received_at_handover' : 'paid_by_bank_transfer', 'payment_status');
            }

            return $booking->fresh();
        });
    }

    /**
     * active -> completed. Records the return inspection and any damages,
     * settles a cash deposit the shop holds, and opens the review window.
     */
    public function returnVehicle(Booking $booking, int $actorId, array $inspection, array $damages = [], ?float $depositDeduction = null, ?string $deductionReason = null): Booking
    {
        if ($booking->status !== Booking::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['status' => ['Only an active booking can be returned.']]);
        }

        // Only a deposit the shop actually took in cash (status held) is settled here.
        $deposit = $booking->securityDeposit;
        $shopHeldDeposit = $deposit
            && $deposit->hold_method === 'cash_on_pickup'
            && $deposit->status === SecurityDeposit::STATUS_HELD
            ? $deposit : null;
        $deduction = round($depositDeduction ?? 0, 2);

        if ($deduction > 0 && !$shopHeldDeposit) {
            throw ValidationException::withMessages(['deposit_deduction' => ['There is no cash deposit held for this booking to deduct from.']]);
        }
        if ($shopHeldDeposit && $deduction > (float) $shopHeldDeposit->amount_collected) {
            throw ValidationException::withMessages(['deposit_deduction' => ['The deduction cannot be more than the deposit collected.']]);
        }
        if ($deduction > 0 && blank($deductionReason)) {
            throw ValidationException::withMessages(['deposit_deduction_reason' => ['Give a reason for keeping part of the deposit.']]);
        }

        return DB::transaction(function () use ($booking, $actorId, $inspection, $damages, $shopHeldDeposit, $deduction, $deductionReason) {
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

            $booking->update([
                'status' => Booking::STATUS_COMPLETED,
                'actual_return_at' => $now,
                'completed_at' => $now,
                'review_eligible_until' => $now->copy()->addDays(14),
            ]);

            // Returned early: the days after today are free to rebook.
            VehicleAvailability::where('vehicle_id', $booking->vehicle_id)
                ->where('booking_id', $booking->id)
                ->where('date', '>', $now->toDateString())
                ->delete();

            if ($shopHeldDeposit) {
                // On the statement: close the deposit charge, keep the damage part, hand the rest back in cash.
                $collected = (float) $shopHeldDeposit->amount_collected;
                $handedBack = round($collected - $deduction, 2);
                Payment::postLine($booking, Payment::TYPE_DEPOSIT_RELEASE, debit: 0, credit: $collected, actorId: $actorId, note: 'Deposit settled at return');
                if ($deduction > 0) {
                    Payment::postLine($booking, Payment::TYPE_DAMAGE, debit: $deduction, credit: 0, actorId: $actorId, note: $deductionReason);
                }
                if ($handedBack > 0) {
                    $this->recordCashPayment($booking, Payment::TYPE_SECURITY_DEPOSIT, $handedBack, paidBack: true);
                }

                $shopHeldDeposit->update([
                    'deductions_amount' => $deduction,
                    'deduction_reason' => $deduction > 0 ? $deductionReason : null,
                    'status' => match (true) {
                        $deduction <= 0 => SecurityDeposit::STATUS_RELEASED,
                        $deduction >= (float) $shopHeldDeposit->amount_collected => SecurityDeposit::STATUS_FORFEITED,
                        default => SecurityDeposit::STATUS_PARTIALLY_RELEASED,
                    },
                    'released_at' => $now,
                    'decided_by' => $actorId,
                ]);
            }

            $booking->vehicle()->increment('booking_count');
            $booking->vehicle()->update(['last_booked_at' => $now]);

            $this->history($booking, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED, 'staff', $actorId);

            $this->notifyCustomer($booking, 'booking_completed', 'Trip completed', "Your rental of {$booking->vehicle->title} is complete — share your experience with a review.", "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    /**
     * What a date change would do, without saving: the new price (from the
     * booking's own locked rates - booking_pricing.pricing_snapshot - never
     * today's vehicle rates), what is already paid, and the new balance.
     * Also used by reschedule() itself so preview and save always agree.
     *
     * @return array{available: bool, conflict: ?string, rental_days: int, pricing: array, total_payable: float, amount_paid: float, balance_due: float, overpaid: float}
     */
    public function previewReschedule(Booking $booking, Carbon $pickupAt, Carbon $returnAt): array
    {
        $this->assertReschedulable($booking, $pickupAt, $returnAt);

        // The rates the customer was quoted, so moving dates never reprices at today's rates.
        $lockedRates = (new VehiclePricing)->forceFill($booking->pricing->pricing_snapshot ?? []);
        $quote = app(BookingPricingCalculator::class)->quote(
            $booking->vehicle, $lockedRates, $pickupAt, $returnAt, (bool) $booking->with_driver, (bool) $booking->delivery_requested,
        );

        $total = (float) $quote['pricing']['total_payable'];
        $paid = $booking->amountPaid();

        // Advisory only (no lock) - reschedule() re-checks under the vehicle row lock before saving.
        $conflict = null;
        try {
            $this->assertNoOverlap($booking->vehicle_id, $pickupAt, $returnAt, $booking->id);
        } catch (HttpException $e) {
            $conflict = $e->getMessage();
        }

        return [
            'available' => $conflict === null,
            'conflict' => $conflict,
            'rental_days' => $quote['rental_days'],
            'pricing' => $quote['pricing'],
            'total_payable' => $total,
            'amount_paid' => $paid,
            'balance_due' => max(0, round($total - $paid, 2)),
            'overpaid' => max(0, round($paid - $total, 2)),
        ];
    }

    /**
     * Change a confirmed booking's pickup/return - shop only, before
     * handover. Same booking, reference and payments: the new dates are
     * re-checked under the vehicle row lock (04-lifecycles.md
     * "Concurrency"), the booked days move, the price is recalculated from
     * the locked rates and payment_status follows what is already paid. If
     * the customer has now paid more than the new total, refunding the
     * difference is between the shop and the customer.
     */
    public function reschedule(Booking $booking, int $actorId, Carbon $pickupAt, Carbon $returnAt, ?string $reason = null): Booking
    {
        $preview = $this->previewReschedule($booking, $pickupAt, $returnAt);

        return DB::transaction(function () use ($booking, $actorId, $pickupAt, $returnAt, $reason, $preview) {
            $vehicle = Vehicle::whereKey($booking->vehicle_id)->lockForUpdate()->firstOrFail();
            $this->assertNoOverlap($vehicle->id, $pickupAt, $returnAt, $booking->id);

            $describe = fn (Carbon $from, Carbon $to) => $from->format('d M Y H:i') . ' → ' . $to->format('d M Y H:i');
            $oldRange = $describe($booking->pickup_at, $booking->return_at);
            $newRange = $describe($pickupAt, $returnAt);

            // Free the old days first: unique(vehicle_id, date) would otherwise reject any day the two ranges share.
            VehicleAvailability::where('vehicle_id', $vehicle->id)->where('booking_id', $booking->id)->delete();

            $oldTotal = (float) $booking->pricing->total_payable;
            $fromPaymentStatus = $booking->payment_status;
            $toPaymentStatus = $preview['amount_paid'] <= 0
                ? Booking::PAYMENT_UNPAID
                : ($preview['balance_due'] <= 0 ? Booking::PAYMENT_PAID : Booking::PAYMENT_PARTIALLY_PAID);

            $booking->update([
                'pickup_at' => $pickupAt,
                'return_at' => $returnAt,
                'rental_days' => $preview['rental_days'],
                'driver_days' => $booking->with_driver ? $preview['rental_days'] : null,
                'payment_status' => $toPaymentStatus,
            ]);

            $pricing = $preview['pricing'];
            $booking->pricing->update([
                'rate_breakdown' => $pricing['rate_breakdown'],
                'base_amount' => $pricing['base_amount'],
                'delivery_amount' => $pricing['delivery_amount'],
                'driver_amount' => $pricing['driver_amount'],
                'subtotal' => $pricing['subtotal'],
                'tax_amount' => $pricing['tax_amount'],
                'total_payable' => $pricing['total_payable'],
                'computed_at' => now(),
                'computed_by' => 'staff',
                'snapshot_hash' => $pricing['snapshot_hash'],
            ]);

            // The price difference goes on the statement: debit if dearer, credit if cheaper.
            $difference = round($preview['total_payable'] - $oldTotal, 2);
            if ($difference !== 0.0) {
                Payment::postLine($booking, Payment::TYPE_ADJUSTMENT, debit: max(0, $difference), credit: max(0, -$difference), actorId: $actorId);
            }

            $this->writeAvailability($vehicle->id, $booking->fresh());

            $this->history($booking, $oldRange, $newRange, 'staff', $actorId, $reason, 'dates');
            if ($fromPaymentStatus !== $toPaymentStatus) {
                $this->history($booking, $fromPaymentStatus, $toPaymentStatus, 'staff', $actorId, 'dates_changed', 'payment_status');
            }

            $money = fn (float $v) => ($booking->pricing->currency ?? 'LKR') . ' ' . number_format($v, 2);
            $balanceNote = $preview['overpaid'] > 0
                ? " You have paid {$money($preview['overpaid'])} more than the new total — the shop will sort out the difference."
                : ($preview['balance_due'] > 0 ? " Balance due: {$money($preview['balance_due'])}." : '');
            $this->notifyCustomer($booking, 'booking_rescheduled', 'Booking dates changed',
                "The shop changed your booking for {$booking->vehicle->title} to {$newRange}. New total: {$money($preview['total_payable'])}.{$balanceNote}"
                . ($reason ? " Reason: {$reason}" : ''),
                "/account/bookings/{$booking->booking_reference}");

            return $booking->fresh();
        });
    }

    private function assertReschedulable(Booking $booking, Carbon $pickupAt, Carbon $returnAt): void
    {
        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            throw ValidationException::withMessages(['status' => ['Only a confirmed booking can have its dates changed — after handover the trip is already under way.']]);
        }
        if ($returnAt->lessThanOrEqualTo($pickupAt)) {
            throw ValidationException::withMessages(['return_at' => ['The return must be after the pickup.']]);
        }
        if ($pickupAt->isPast()) {
            throw ValidationException::withMessages(['pickup_at' => ['The new pickup must be in the future.']]);
        }
        if ($booking->pickup_at->equalTo($pickupAt) && $booking->return_at->equalTo($returnAt)) {
            throw ValidationException::withMessages(['pickup_at' => ['These are the dates the booking already has.']]);
        }
    }

    /**
     * confirmed -> no_show. Applied by a sweep when now() > pickup_at + no_show_grace_hours and the booking never reached handover.
     * Frees the booked days - left in place, unique(vehicle_id, date) would make the next accept over them fail on insert.
     */
    public function noShow(Booking $booking): Booking
    {
        return DB::transaction(function () use ($booking) {
            $booking->update(['status' => Booking::STATUS_NO_SHOW]);

            VehicleAvailability::where('vehicle_id', $booking->vehicle_id)->where('booking_id', $booking->id)->delete();
            $this->reverseCharges($booking, null);
            $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_NO_SHOW, 'system', null);

            $this->notifyCustomer($booking, 'booking_no_show', 'Booking marked as no-show', "You didn't pick up {$booking->vehicle->title} at the scheduled time, so the booking has been closed.", "/account/bookings/{$booking->booking_reference}");
            $this->notifyShopOwner($booking, 'booking_no_show', 'Customer no-show', "The customer didn't pick up {$booking->vehicle->title} ({$booking->booking_reference}) — the booking is closed and the dates are free again.", '/vendor/bookings');

            return $booking->fresh();
        });
    }

    /**
     * The guarded block from 04-lifecycles.md "Concurrency" verbatim:
     * row lock already held by the caller on $vehicleId's vehicle row,
     * this re-validates against confirmed/active bookings and
     * blocked/maintenance availability rows.
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


        $blocked = VehicleAvailability::where('vehicle_id', $vehicleId)
            ->whereIn('status', [VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$pickupAt->toDateString(), $returnAt->copy()->subDay()->toDateString()])
            ->exists();
        abort_if($blocked, 409, 'Some of those dates are unavailable.');
    }

    /**
     * Cash handed to the shop at the counter — recorded so there is evidence of how much was paid and when.
     * initiated_by is the paying customer (FK to customers); the staff member who took it is on the
     * payment_status history row and the handover inspection.
     */
    /** Cash received from the customer (credit), or handed back to them (debit) when $paidBack. */
    private function recordCashPayment(Booking $booking, string $type, float $amount, bool $paidBack = false): void
    {
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
            'method' => Payment::METHOD_CASH,
            'type' => $type,
            'credit' => $paidBack ? 0 : $amount,
            'debit' => $paidBack ? $amount : 0,
            'currency' => $booking->pricing->currency,
            'status' => Payment::STATUS_SUCCEEDED,
            'paid_at' => now(),
            'idempotency_key' => (string) Str::uuid(),
            'initiated_by' => $booking->customer_id,
        ]);

        $payment->settleBalance();
    }

    private function history(Booking $booking, ?string $from, string $to, string $actorType, ?int $actorId, ?string $reason = null, string $field = 'status'): void
    {
        BookingStatusHistory::create([
            'booking_id' => $booking->id,
            'field' => $field,
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
