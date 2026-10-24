<?php

namespace App\Console\Commands;

use App\Models\ReservationHold;
use Illuminate\Console\Command;

/**
 * active holds past expires_at -> expired. A hold normally dies together
 * with its booking via ExpireUnpaidBookings, but this is the backstop for
 * any hold whose booking didn't transition for some other reason - see
 * app-doc/marketplace/04-lifecycles.md "Scheduled sweeps".
 */
class ReleaseExpiredHolds extends Command
{
    protected $signature = 'holds:release-expired';
    protected $description = 'Expire reservation holds past their expiry time';

    public function handle(): int
    {
        $count = ReservationHold::where('status', ReservationHold::STATUS_ACTIVE)
            ->where('expires_at', '<', now())
            ->update(['status' => ReservationHold::STATUS_EXPIRED]);

        $this->info("Released {$count} expired hold(s).");

        return self::SUCCESS;
    }
}
