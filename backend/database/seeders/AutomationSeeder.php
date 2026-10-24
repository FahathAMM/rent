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
    }
}
