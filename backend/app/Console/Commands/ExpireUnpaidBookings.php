<?php

namespace App\Console\Commands;

use App\Actions\TransitionBooking;
use App\Models\Booking;
use Illuminate\Console\Command;

/** accepted + unpaid past payment_deadline_at -> expired, hold released. See app-doc/marketplace/04-lifecycles.md "Scheduled sweeps". */
class ExpireUnpaidBookings extends Command
{
    protected $signature = 'bookings:expire-unpaid';
    protected $description = 'Expire accepted bookings whose payment window has elapsed';

    public function handle(TransitionBooking $transitions): int
    {
        $bookings = Booking::where('status', Booking::STATUS_ACCEPTED)
            ->whereIn('payment_status', [Booking::PAYMENT_UNPAID, Booking::PAYMENT_INITIATED, Booking::PAYMENT_FAILED])
            ->where('payment_deadline_at', '<', now())
            ->get();

        foreach ($bookings as $booking) {
            $transitions->expireUnpaid($booking);
        }

        $this->info("Expired {$bookings->count()} unpaid booking(s).");

        return self::SUCCESS;
    }
}
