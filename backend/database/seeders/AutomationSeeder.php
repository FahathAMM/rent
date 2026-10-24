<?php

namespace Database\Seeders;

use App\Models\Automation;
use Illuminate\Database\Seeder;

/**
 * Rows the /platform/settings "Automations" screen manages — the
 * admin-facing view of what Automation::scheduleAll() actually schedules.
 */
class AutomationSeeder extends Seeder
{
    public function run(): void
    {
        Automation::firstOrCreate(
            ['name' => 'Database Backup'],
            ['interval' => 'everyTenMinutes', 'is_active' => true]
        );

        Automation::firstOrCreate(
            ['name' => 'Expire Unanswered Bookings'],
            ['interval' => 'everyFiveMinutes', 'is_active' => true]
        );

        Automation::firstOrCreate(
            ['name' => 'Expire Unpaid Bookings'],
            ['interval' => 'everyFiveMinutes', 'is_active' => true]
        );

        Automation::firstOrCreate(
            ['name' => 'Release Expired Holds'],
            ['interval' => 'everyFiveMinutes', 'is_active' => true]
        );

        Automation::firstOrCreate(
            ['name' => 'Flag No-Show Bookings'],
            ['interval' => 'everyFifteenMinutes', 'is_active' => true]
        );

        // Automation::INTERVALS has no "daily" entry (only 5min-6hr named
        // intervals) - fixed_time is the model's own mechanism for a true
        // once-a-day job, matching app-doc/marketplace/04-lifecycles.md
        // "payouts:build-cycle | daily".
        Automation::firstOrCreate(
            ['name' => 'Build Owner Payouts'],
            ['interval' => Automation::FIXED_TIME, 'fixed_time' => '02:00', 'is_active' => true]
        );
    }
}
