<?php

namespace App\Console\Commands;

use App\Actions\TransitionBooking;
use App\Models\Booking;
use App\Models\PlatformSetting;
use Illuminate\Console\Command;

/** confirmed past pickup_at + no_show_grace_hours, never handed over -> no_show. See app-doc/marketplace/04-lifecycles.md "Scheduled sweeps". */
class FlagNoShowBookings extends Command
{
    protected $signature = 'bookings:flag-no-show';
    protected $description = 'Flag confirmed bookings as no-show once the pickup grace period has elapsed';

    public function handle(TransitionBooking $transitions): int
    {
        $graceHours = (int) PlatformSetting::get('no_show_grace_hours', 4);

        $bookings = Booking::where('status', Booking::STATUS_CONFIRMED)
            ->where('pickup_at', '<', now()->subHours($graceHours))
            ->get();

        foreach ($bookings as $booking) {
            $transitions->noShow($booking);
        }

        $this->info("Flagged {$bookings->count()} no-show booking(s).");

        return self::SUCCESS;
    }
}
