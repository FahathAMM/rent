<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingFinancial;
use App\Models\Dispute;
use App\Models\DisputeMessage;
use App\Models\SystemAdmin;
use App\Notifications\MarketplaceNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * An open dispute sets bookings.has_open_dispute and the booking's
 * booking_financials.settlement_status to on_hold - the payout builder
 * already only selects settlement_status=unsettled, so an on_hold
 * booking is skipped with no change needed there. See Dispute's
 * docblock and app-doc/marketplace/02-data-model.md "disputes".
 */
class DisputeService
{
    private const OPEN_STATUSES = [
        Dispute::STATUS_OPEN,
        Dispute::STATUS_UNDER_REVIEW,
        Dispute::STATUS_AWAITING_INFO,
        Dispute::STATUS_ESCALATED,
    ];

    public function create(User $user, Booking $booking, string $raisedBySide, array $data): Dispute
    {
        if (!in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true)) {
            throw ValidationException::withMessages(['booking' => ['A dispute can only be raised on a confirmed, active, or completed booking.']]);
        }

        return DB::transaction(function () use ($user, $booking, $raisedBySide, $data) {
            $dispute = Dispute::create($data + [
                'dispute_reference' => 'DSP-' . Str::upper(Str::random(10)),
                'booking_id' => $booking->id,
                'raised_by_user_id' => $user->id,
                'raised_by_side' => $raisedBySide,
                'status' => Dispute::STATUS_OPEN,
                'priority' => $data['priority'] ?? 'normal',
            ]);

            $booking->update(['has_open_dispute' => true]);
            $booking->financials?->update(['settlement_status' => BookingFinancial::SETTLEMENT_ON_HOLD]);

            $this->notifyCounterpart($booking, $raisedBySide, new MarketplaceNotification(
                type: 'dispute_opened',
                title: 'A dispute was opened',
                body: "A dispute was raised on booking {$booking->booking_reference}: {$dispute->subject}",
                actionUrl: '/account/disputes/' . $dispute->dispute_reference,
            ));

            return $dispute;
        });
    }

    /**
     * $posterSide is the SIDE OF THE BOOKING the author is posting from
     * ('customer' or 'owner'/'staff'), not the dispute's raised_by_side -
     * the notification always goes to whichever side did NOT just post,
     * regardless of who originally raised the dispute. null when the
     * author is a platform admin posting a non-internal message (the
     * admin has no "other side" of their own; both parties are notified).
     */
    public function addMessage(Dispute $dispute, string $authorType, int $authorId, string $message, bool $isInternal = false, ?string $posterSide = null): DisputeMessage
    {
        $dm = DisputeMessage::create([
            'dispute_id' => $dispute->id,
            'author_type' => $authorType,
            'author_id' => $authorId,
            'message' => $message,
            'is_internal' => $isInternal,
        ]);

        if (!$isInternal) {
            $booking = $dispute->booking;
            $notification = new MarketplaceNotification(
                type: 'dispute_message',
                title: 'New message on your dispute',
                body: "A new message was posted on dispute {$dispute->dispute_reference}.",
                actionUrl: '/account/disputes/' . $dispute->dispute_reference,
            );

            if ($booking && $posterSide !== null) {
                $this->notifyCounterpart($booking, $posterSide, $notification);
            } elseif ($booking) {
                $dispute->raisedBy?->notify($notification);
                $this->notifyCounterpart($booking, $dispute->raised_by_side, $notification);
            }
        }

        return $dm;
    }

    public function assign(SystemAdmin $admin, Dispute $dispute, ?int $assignToId = null): Dispute
    {
        $dispute->update([
            'assigned_to' => $assignToId ?? $admin->id,
            'status' => $dispute->status === Dispute::STATUS_OPEN ? Dispute::STATUS_UNDER_REVIEW : $dispute->status,
        ]);

        return $dispute->fresh();
    }

    public function resolve(SystemAdmin $admin, Dispute $dispute, array $data): Dispute
    {
        return DB::transaction(function () use ($admin, $dispute, $data) {
            $close = (bool) ($data['close'] ?? false);

            $dispute->update([
                'status' => $close ? Dispute::STATUS_CLOSED : Dispute::STATUS_RESOLVED,
                'resolution' => $data['resolution'],
                'resolution_amount' => $data['resolution_amount'] ?? null,
                'resolution_in_favour_of' => $data['resolution_in_favour_of'],
                'resolved_by' => $admin->id,
                'resolved_at' => now(),
                'closed_at' => $close ? now() : null,
            ]);

            $booking = $dispute->booking;
            $this->releaseBookingIfClear($booking);

            $notification = new MarketplaceNotification(
                type: 'dispute_resolved',
                title: 'Dispute resolved',
                body: "Dispute {$dispute->dispute_reference} on booking {$booking->booking_reference} has been resolved.",
                actionUrl: '/account/disputes/' . $dispute->dispute_reference,
            );
            $dispute->raisedBy?->notify($notification);
            $this->notifyCounterpart($booking, $dispute->raised_by_side, $notification);

            return $dispute->fresh();
        });
    }

    /** Clears has_open_dispute and reinstates settlement only once every dispute on the booking is closed/resolved. */
    private function releaseBookingIfClear(Booking $booking): void
    {
        $stillOpen = Dispute::where('booking_id', $booking->id)
            ->whereIn('status', self::OPEN_STATUSES)
            ->exists();

        if ($stillOpen) {
            return;
        }

        $booking->update(['has_open_dispute' => false]);

        $financials = $booking->financials;
        if ($financials && $financials->settlement_status === BookingFinancial::SETTLEMENT_ON_HOLD) {
            $financials->update(['settlement_status' => BookingFinancial::SETTLEMENT_UNSETTLED]);
        }
    }

    private function notifyCounterpart(Booking $booking, string $raisedBySide, MarketplaceNotification $notification): void
    {
        if ($raisedBySide === 'customer') {
            $booking->shop?->owner?->notify($notification);
        } else {
            $booking->customer?->notify($notification);
        }
    }
}
