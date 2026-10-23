<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Production-safe entry point — `php artisan db:seed` always creates the
 * real infra (menu/roles/permissions, subscription plans, the platform
 * admin account, default platform branding). ChickenShopDemoSeeder (the
 * "Golden Chicken Trading" demo tenant) is called separately below, gated
 * to non-production environments only.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Menu structure — also creates the owner/admin/super-admin roles,
        // nav-visibility permissions, and syncs them.
        $this->call(MenuSeeder::class);
        $this->call(PlanSeeder::class);
        $this->call(PlatformSeeder::class);
        $this->call(AutomationSeeder::class);

        if (!app()->environment('production')) {
            $this->call(ChickenShopDemoSeeder::class);
        }
    }
}
