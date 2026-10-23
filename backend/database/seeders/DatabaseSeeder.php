<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Production-safe entry point — `php artisan db:seed` always creates the
 * real infra (menu/roles/permissions, platform admin account, default
 * platform branding, scheduled-task definitions). A marketplace demo
 * dataset (shops, owners, vehicles, bookings) is seeded separately and
 * gated to non-production environments — see MarketplaceDemoSeeder
 * (added in a later phase).
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Menu structure — also creates the roles, nav-visibility
        // permissions, and syncs them.
        $this->call(MenuSeeder::class);
        $this->call(PlatformSeeder::class);
        $this->call(AutomationSeeder::class);

        // if (!app()->environment('production')) {
        //     $this->call(MarketplaceDemoSeeder::class);
        // }
    }
}
