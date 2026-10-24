<?php

namespace App\Console\Commands;

use App\Actions\TransitionBooking;
use App\Models\Booking;
use Illuminate\Console\Command;

/**
 * pending past owner_response_deadline_at -> expired. See
 * app-doc/marketplace/04-lifecycles.md "Scheduled sweeps". The
 * owner_no_response_policy alternatives (escalate_to_admin, auto_accept)
 * are a later refinement — every shop currently falls back to
 * auto_reject (expiry) regardless of shop_settings.auto_accept_bookings,
 * since accepting on the owner's behalf needs the same concurrency guard
 * TransitionBooking::accept() already has and no actor to attribute it to.
 */
class ExpireUnansweredBookings extends Command
{
    protected $signature = 'bookings:expire-unanswered';
    protected $description = 'Expire pending booking requests past their owner response deadline';

    public function handle(TransitionBooking $transitions): int
    {
        $bookings = Booking::where('status', Booking::STATUS_PENDING)
            ->where('owner_response_deadline_at', '<', now())
            ->get();

        foreach ($bookings as $booking) {
            $transitions->expireUnanswered($booking);
        }

        $this->info("Expired {$bookings->count()} unanswered booking(s).");

        return self::SUCCESS;
    }
}
