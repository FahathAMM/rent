<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Location;
use App\Models\RentalShop;
use Database\Seeders\Backup\MarketplaceDemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * The default demo dataset (non-production only, see DatabaseSeeder): 5
 * verified shops with 4-5 published vehicles each, every shop on its free
 * Pro trial. Reuses the fleet, towns and helpers of the larger 50-shop
 * seeder kept in Backup\MarketplaceDemoSeeder.
 *
 * Two fixed logins (password = PASSWORD below, same as every demo account):
 *   - fahath@ven.com — vendor, owner of the first shop  (/vendor/login)
 *   - fahath@cus.com — customer                         (/login)
 * The other four shop owners log in with "<shop-slug>@demo.lk".
 * Skips if any shop already exists. Photos: DemoVehiclePhotoSeeder.
 */
class DemoSeeder extends MarketplaceDemoSeeder
{
    protected const SHOP_COUNT = 5;
    protected const VEHICLES_PER_SHOP = [4, 5];

    private const VENDOR = ['email' => 'fahath@ven.com', 'name' => 'Fahath'];
    private const CUSTOMER = ['email' => 'fahath@cus.com', 'name' => 'Fahath'];

    public function run(): void
    {
        if (RentalShop::query()->exists()) {
            $this->command?->info('Demo data already present — skipping.');
            return;
        }

        $catalogue = $this->catalogue();
        $vehicleCount = 0;

        DB::transaction(function () use ($catalogue, &$vehicleCount) {
            foreach ($this->shopNames() as $i => $name) {
                $shop = $this->seedShop($name, $i === 0 ? self::VENDOR : [], verified: true);
                $location = Location::where('shop_id', $shop->id)->first();

                $count = fake()->numberBetween(...static::VEHICLES_PER_SHOP);
                for ($v = 0; $v < $count; $v++) {
                    $this->seedVehicle($shop, $location, fake()->randomElement(static::FLEET), $catalogue);
                    $vehicleCount++;
                }
            }

            Customer::firstOrCreate(['email' => self::CUSTOMER['email']], [
                'name' => self::CUSTOMER['name'],
                'password' => Hash::make(static::PASSWORD),
                'phone' => '07' . fake()->numerify('########'),
                'status' => Customer::STATUS_ACTIVE,
                'registration_source' => 'demo_seeder',
            ]);
        });

        $this->command?->info('Seeded ' . static::SHOP_COUNT . " shops, {$vehicleCount} vehicles, vendor " . self::VENDOR['email'] . ' and customer ' . self::CUSTOMER['email'] . '.');
    }
}
