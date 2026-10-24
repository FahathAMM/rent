<?php

namespace App\Actions;

use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\ReservationHold;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
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

            return $booking->fresh();
        });
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
}
