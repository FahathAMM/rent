<?php

namespace App\Console\Commands;

use App\Services\PayoutService;
use Illuminate\Console\Command;

/** See app-doc/marketplace/04-lifecycles.md "Payout cycle" and PayoutService::buildCycle(). */
class BuildOwnerPayouts extends Command
{
    protected $signature = 'payouts:build-cycle';
    protected $description = 'Build draft owner payouts from eligible, unsettled booking financials';

    public function handle(PayoutService $payouts): int
    {
        $created = $payouts->buildCycle();

        $this->info('Built ' . count($created) . ' payout(s): ' . implode(', ', array_map(fn ($p) => $p->payout_reference, $created)));

        return self::SUCCESS;
    }
}
