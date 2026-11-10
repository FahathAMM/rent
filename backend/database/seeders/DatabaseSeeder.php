<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Same data in every environment (local and production) — `php artisan
 * db:seed` creates the real infra (menu/roles/permissions, platform admin
 * account, default platform branding, vehicle catalogue, platform settings,
 * locations) and the F2-VIP Rental shop with its 10 vehicles and 100
 * bookings, with real photos for those vehicles (downloaded from Wikimedia
 * Commons on the first run — see F2VipRentalShopSeeder).
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
        $this->call(CustomerSeeder::class);
        $this->call(F2VipRentalShopSeeder::class);
        $this->call(F2VipBookingSeeder::class);
    }
}
