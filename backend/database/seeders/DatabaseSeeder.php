<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Production-safe entry point — `php artisan db:seed` always creates the
 * real infra (menu/roles/permissions, platform admin account, default
 * platform branding, vehicle catalogue, platform settings, locations).
 * A small marketplace demo (5 shops with 4-5 vehicles each, a demo vendor
 * and customer, plus vehicle photos) is gated to non-production — see
 * DemoSeeder and DemoVehiclePhotoSeeder. The larger 50-shop demo is kept
 * in Backup\MarketplaceDemoSeeder and can be run on its own.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Menu structure — also creates the roles, nav-visibility
        // permissions, and syncs them.
        $this->call(MenuSeeder::class);
        $this->call(PlatformSeeder::class);
        $this->call(VehicleCategorySeeder::class);
        $this->call(VehicleBrandSeeder::class);
        $this->call(VehicleColourSeeder::class);
        $this->call(PlatformSettingSeeder::class);
        $this->call(SriLankaLocationSeeder::class);

        if (!app()->environment('production')) {
            $this->call(DemoSeeder::class);
            $this->call(DemoVehiclePhotoSeeder::class);
        }
    }
}
