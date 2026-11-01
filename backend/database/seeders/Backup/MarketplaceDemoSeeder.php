<?php

namespace Database\Seeders\Backup;

use App\Models\Administration\User;
use App\Models\Location;
use App\Models\OwnerBankDetail;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleColour;
use App\Models\VehicleModel;
use App\Models\VehiclePickupLocation;
use App\Models\VehiclePricing;
use App\Services\SubscriptionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Sri Lankan marketplace demo: 50 published rental shops across the
 * island, each with 5-10 published vehicles drawn from the brand/model
 * catalogue. Shops and vehicles only — no customers or bookings. Gated
 * to non-production by DatabaseSeeder; skips if any shop already exists
 * rather than duplicating.
 *
 * Every shop owner logs in with "<shop-slug>@demo.lk" / "password".
 * Photos are attached afterwards by DemoVehiclePhotoSeeder.
 *
 * BACKUP — the default demo is now the 5-shop Database\Seeders\DemoSeeder
 * (which reuses this class). Run this one on an empty database with:
 *   php artisan db:seed --class="Database\Seeders\Backup\MarketplaceDemoSeeder"
 *   php artisan db:seed --class=DemoVehiclePhotoSeeder
 */
class MarketplaceDemoSeeder extends Seeder
{
    protected const PASSWORD = 'password';
    protected const SHOP_COUNT = 50;
    protected const VEHICLES_PER_SHOP = [5, 10];

    /** town => district, weighted toward where rental demand actually is */
    protected const TOWNS = [
        'Colombo' => 'Colombo', 'Nugegoda' => 'Colombo', 'Maharagama' => 'Colombo', 'Dehiwala-Mount Lavinia' => 'Colombo',
        'Battaramulla' => 'Colombo', 'Moratuwa' => 'Colombo', 'Negombo' => 'Gampaha', 'Katunayake' => 'Gampaha',
        'Gampaha' => 'Gampaha', 'Wattala' => 'Gampaha', 'Kandy' => 'Kandy', 'Peradeniya' => 'Kandy', 'Gampola' => 'Kandy',
        'Galle' => 'Galle', 'Hikkaduwa' => 'Galle', 'Bentota' => 'Galle', 'Matara' => 'Matara', 'Weligama' => 'Matara',
        'Tangalle' => 'Hambantota', 'Tissamaharama' => 'Hambantota', 'Nuwara Eliya' => 'Nuwara Eliya', 'Hatton' => 'Nuwara Eliya',
        'Ella' => 'Badulla', 'Bandarawela' => 'Badulla', 'Badulla' => 'Badulla', 'Dambulla' => 'Matale', 'Matale' => 'Matale',
        'Kurunegala' => 'Kurunegala', 'Chilaw' => 'Puttalam', 'Anuradhapura' => 'Anuradhapura', 'Polonnaruwa' => 'Polonnaruwa',
        'Trincomalee' => 'Trincomalee', 'Batticaloa' => 'Batticaloa', 'Ampara' => 'Ampara', 'Jaffna' => 'Jaffna',
        'Vavuniya' => 'Vavuniya', 'Ratnapura' => 'Ratnapura', 'Kegalle' => 'Kegalle', 'Kalutara' => 'Kalutara', 'Panadura' => 'Kalutara',
    ];

    protected const NAME_PREFIXES = [
        'Lanka', 'Ceylon', 'Island', 'Serendib', 'Lion', 'Royal', 'Golden', 'Pearl', 'Sigiri', 'Ruhuna',
        'Sunrise', 'Tropical', 'Ocean', 'Hill Country', 'Blue Lagoon', 'Green Valley', 'Coconut', 'Elephant',
        'Lotus', 'Tea Country', 'Express', 'Prime', 'Smart', 'Easy', 'Budget', 'Comfort', 'Star', 'Silver Line',
    ];

    protected const NAME_SUFFIXES = [
        'Rent a Car', 'Car Rentals', 'Vehicle Rentals', 'Travels', 'Tours & Rentals', 'Auto Hire',
        'Cabs & Rentals', 'Wheels', 'Drive', 'Motors', 'Leisure Rentals', 'Transport Services',
    ];

    /**
     * [make, model, category slug, transmission, fuel, seats, doors, daily rate range LKR, deposit LKR, features]
     */
    protected const FLEET = [
        ['Toyota', 'Aqua', 'car', 'automatic', 'hybrid', 5, 5, [6000, 7500], 30000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Hybrid Fuel Saver']],
        ['Toyota', 'Prius', 'car', 'automatic', 'hybrid', 5, 5, [8000, 10000], 40000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Cruise Control']],
        ['Toyota', 'Premio', 'car', 'automatic', 'petrol', 5, 4, [7000, 9000], 35000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Leather Seats']],
        ['Toyota', 'Axio', 'car', 'automatic', 'hybrid', 5, 4, [6500, 8000], 30000, ['Air Conditioning', 'Bluetooth', 'USB Charging']],
        ['Toyota', 'Vitz', 'car', 'automatic', 'petrol', 5, 5, [5000, 6000], 25000, ['Air Conditioning', 'USB Charging']],
        ['Suzuki', 'Wagon R', 'car', 'automatic', 'petrol', 5, 5, [5000, 6000], 25000, ['Air Conditioning', 'Bluetooth', 'USB Charging']],
        ['Suzuki', 'Alto', 'car', 'manual', 'petrol', 4, 5, [4000, 5000], 20000, ['Air Conditioning']],
        ['Suzuki', 'Swift', 'car', 'automatic', 'petrol', 5, 5, [5500, 7000], 25000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Honda', 'Fit', 'car', 'automatic', 'hybrid', 5, 5, [5500, 7000], 25000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Honda', 'Grace', 'car', 'automatic', 'hybrid', 5, 4, [6500, 8000], 30000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Nissan', 'Leaf', 'car', 'automatic', 'electric', 5, 5, [7000, 8500], 35000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Fast Charging']],
        ['Perodua', 'Axia', 'car', 'automatic', 'petrol', 5, 5, [4500, 5500], 20000, ['Air Conditioning', 'USB Charging']],
        ['Honda', 'Vezel', 'suv', 'automatic', 'hybrid', 5, 5, [12000, 15000], 60000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Cruise Control']],
        ['Toyota', 'Land Cruiser Prado', 'suv', 'automatic', 'diesel', 7, 5, [25000, 32000], 100000, ['Air Conditioning', 'Bluetooth', '4WD', 'Leather Seats', 'Sunroof']],
        ['Mitsubishi', 'Montero', 'suv', 'automatic', 'diesel', 7, 5, [17000, 21000], 75000, ['Air Conditioning', 'Bluetooth', '4WD', 'Reverse Camera']],
        ['Mitsubishi', 'Outlander', 'suv', 'automatic', 'petrol', 7, 5, [14000, 17000], 60000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Nissan', 'X-Trail', 'suv', 'automatic', 'hybrid', 5, 5, [13000, 16000], 60000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', '4WD']],
        ['Kia', 'Sportage', 'suv', 'automatic', 'diesel', 5, 5, [13000, 16000], 60000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Toyota', 'KDH', 'van', 'manual', 'diesel', 14, 4, [11000, 14000], 50000, ['Air Conditioning', 'Reclining Seats', 'Roof Rack']],
        ['Toyota', 'Hiace', 'van', 'manual', 'diesel', 12, 4, [10000, 13000], 50000, ['Air Conditioning', 'Reclining Seats']],
        ['Nissan', 'Caravan', 'van', 'manual', 'diesel', 12, 4, [11000, 14000], 50000, ['Air Conditioning', 'Reclining Seats', 'Roof Rack']],
        ['Suzuki', 'Every', 'van', 'manual', 'petrol', 4, 4, [5000, 6500], 20000, ['Air Conditioning']],
        ['Toyota', 'Coaster', 'minibus', 'manual', 'diesel', 29, 2, [22000, 28000], 100000, ['Air Conditioning', 'PA System', 'Reclining Seats']],
        ['Ashok Leyland', 'Lynx', 'minibus', 'manual', 'diesel', 26, 2, [18000, 23000], 80000, ['Air Conditioning', 'PA System']],
        ['Bajaj', 'RE Three-wheeler', 'tuk-tuk', 'manual', 'petrol', 3, 0, [2500, 3500], 10000, ['Rain Covers', 'Phone Holder']],
        ['TVS', 'King', 'tuk-tuk', 'manual', 'petrol', 3, 0, [2500, 3500], 10000, ['Rain Covers']],
        ['Hero', 'Pleasure', 'scooter', 'automatic', 'petrol', 2, 0, [1800, 2500], 10000, ['Helmet x2', 'Phone Holder']],
        ['TVS', 'Ntorq', 'scooter', 'automatic', 'petrol', 2, 0, [2000, 2800], 10000, ['Helmet x2', 'USB Charging']],
        ['Yamaha', 'Ray ZR', 'scooter', 'automatic', 'petrol', 2, 0, [1800, 2500], 10000, ['Helmet x2']],
        ['Bajaj', 'Pulsar', 'motorcycle', 'manual', 'petrol', 2, 0, [2500, 3500], 15000, ['Helmet x2', 'Saddle Bags']],
        ['Yamaha', 'FZ', 'motorcycle', 'manual', 'petrol', 2, 0, [3000, 4000], 15000, ['Helmet x2', 'Phone Holder']],
        ['Toyota', 'Hilux', 'pickup-lorry', 'manual', 'diesel', 5, 4, [12000, 15000], 60000, ['Air Conditioning', '4WD', 'Cargo Bed']],
        ['Isuzu', 'D-Max', 'pickup-lorry', 'manual', 'diesel', 5, 4, [11000, 14000], 60000, ['Air Conditioning', 'Cargo Bed']],
        ['Isuzu', 'Elf', 'pickup-lorry', 'manual', 'diesel', 3, 2, [10000, 13000], 50000, ['Cargo Box']],
        ['Mercedes-Benz', 'E-Class', 'luxury', 'automatic', 'petrol', 5, 4, [35000, 45000], 150000, ['Air Conditioning', 'Leather Seats', 'Sunroof', 'Bluetooth']],
        ['BMW', '5 Series', 'luxury', 'automatic', 'petrol', 5, 4, [35000, 45000], 150000, ['Air Conditioning', 'Leather Seats', 'Bluetooth', 'Parking Sensors']],
        ['Land Rover', 'Defender', 'luxury', 'automatic', 'diesel', 7, 5, [45000, 60000], 200000, ['Air Conditioning', '4WD', 'Leather Seats', 'Bluetooth']],
        ['Mercedes-Benz', 'C-Class', 'wedding-car', 'automatic', 'petrol', 5, 4, [30000, 40000], 100000, ['Air Conditioning', 'Leather Seats', 'Decoration Ready', 'Chauffeur Available']],
        ['Audi', 'A4', 'wedding-car', 'automatic', 'petrol', 5, 4, [28000, 36000], 100000, ['Air Conditioning', 'Leather Seats', 'Decoration Ready']],
    ];

    public function run(): void
    {
        if (RentalShop::query()->exists()) {
            $this->command?->info('Marketplace demo data already present — skipping.');
            return;
        }

        $catalogue = $this->catalogue();

        $vehicleCount = 0;

        DB::transaction(function () use ($catalogue, &$vehicleCount) {
            foreach ($this->shopNames() as $name) {
                $shop = $this->seedShop($name);
                $location = Location::where('shop_id', $shop->id)->first();

                $count = fake()->numberBetween(...static::VEHICLES_PER_SHOP);
                for ($i = 0; $i < $count; $i++) {
                    $this->seedVehicle($shop, $location, fake()->randomElement(static::FLEET), $catalogue);
                    $vehicleCount++;
                }
            }
        });

        $this->command?->info('Seeded ' . static::SHOP_COUNT . " shops and {$vehicleCount} vehicles.");
    }

    protected function catalogue(): array
    {
        return [
            'categories' => VehicleCategory::pluck('id', 'slug'),
            'brands' => VehicleBrand::pluck('id', 'name'),
            // "brand_id:Model name" => model, so the same model name under two brands can't collide.
            'models' => VehicleModel::with('variants')->get()->keyBy(fn (VehicleModel $m) => "{$m->brand_id}:{$m->name}"),
            'colours' => VehicleColour::all(),
        ];
    }

    /** @return string[] SHOP_COUNT unique "Prefix Suffix" names */
    protected function shopNames(): array
    {
        $all = [];
        foreach (static::NAME_PREFIXES as $prefix) {
            foreach (static::NAME_SUFFIXES as $suffix) {
                $all[] = "{$prefix} {$suffix}";
            }
        }

        return Collection::make($all)->shuffle()->take(static::SHOP_COUNT)->all();
    }

    /**
     * @param  array{email?: string, name?: string}  $owner  fixed owner login (otherwise "<slug>@demo.lk")
     * @param  bool|null  $verified  null = random (70% verified)
     */
    protected function seedShop(string $name, array $owner = [], ?bool $verified = null): RentalShop
    {
        $city = fake()->randomElement(array_keys(static::TOWNS));
        $district = static::TOWNS[$city];
        $slug = Str::slug($name);
        $email = $owner['email'] ?? "{$slug}@demo.lk";
        $ownerName = $owner['name'] ?? fake()->firstName() . ' ' . fake()->randomElement([
            'Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Bandara', 'Wickramasinghe', 'Rajapaksa', 'Gunawardena',
            'Dissanayake', 'Herath', 'Mendis', 'Kumara', 'Rathnayake', 'Senanayake', 'Nadarajah', 'Mohamed',
        ]);
        $verified ??= fake()->boolean(70);

        $owner = User::create([
            'name' => $ownerName,
            'email' => $email,
            'password' => Hash::make(static::PASSWORD),
            'phone' => '07' . fake()->numerify('########'),
            'status' => User::STATUS_ACTIVE,
            'email_verified_at' => now(),
            'registration_source' => 'demo_seeder',
        ]);
        $owner->assignRole('customer');

        $shop = RentalShop::create([
            'owner_user_id' => $owner->id,
            'name' => $name,
            'slug' => $slug,
            'description' => "{$name} is a family-run vehicle rental business based in {$city}, offering self-drive and chauffeur-driven hires across Sri Lanka.",
            'tagline' => fake()->randomElement([
                'Reliable rentals, fair prices.', 'Your journey, our wheels.', 'Explore Sri Lanka your way.',
                'Clean cars, friendly service.', 'Island-wide pickup and delivery.', 'Drive with confidence.',
            ]),
            'email' => $email,
            'phone' => '07' . fake()->numerify('########'),
            'whatsapp' => '07' . fake()->numerify('########'),
            'address_line_1' => fake()->buildingNumber() . ' ' . fake()->randomElement(['Main Street', 'Temple Road', 'Station Road', 'Lake Road', 'Galle Road', 'Kandy Road']),
            'city' => $city,
            'district' => $district,
            'operating_hours' => $this->operatingHours(),
            'policies' => RentalShop::DEFAULT_POLICIES,
            'business_registration_no' => 'PV ' . fake()->numerify('########'),
            'status' => RentalShop::STATUS_ACTIVE,
            'verification_status' => $verified ? RentalShop::VERIFICATION_VERIFIED : RentalShop::VERIFICATION_UNVERIFIED,
            'verified_at' => $verified ? now()->subDays(fake()->numberBetween(10, 300)) : null,
            'is_published' => true,
            'published_at' => now()->subDays(fake()->numberBetween(5, 365)),
        ]);

        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole(User::SHOP_ROLE_OWNER);

        ShopSettings::createFor($shop->id);

        OwnerBankDetail::create([
            'shop_id' => $shop->id,
            'account_holder_name' => $ownerName,
            'bank_name' => fake()->randomElement(['Commercial Bank', 'Sampath Bank', 'HNB', 'Bank of Ceylon', "People's Bank", 'NDB']),
            'branch_name' => $city,
            'account_number' => fake()->numerify('##########'),
            'account_number_last4' => fake()->numerify('####'),
            'account_type' => 'savings',
            'is_primary' => true,
            'verification_status' => 'verified',
            'verified_at' => now(),
        ]);

        Location::create([
            'shop_id' => $shop->id, 'name' => "{$name} - Main Branch", 'type' => 'branch',
            'address' => "{$shop->address_line_1}, {$city}", 'city' => $city, 'district' => $district,
            'country' => 'Sri Lanka', 'phone' => $shop->phone, 'is_active' => true,
        ]);

        // Verified shops start their free trial — a shop with no plan has its vendor workspace locked.
        if ($verified) {
            app(SubscriptionService::class)->startTrial($shop);
        }

        return $shop;
    }

    protected function seedVehicle(RentalShop $shop, ?Location $location, array $spec, array $catalogue): void
    {
        [$make, $model, $catSlug, $transmission, $fuel, $seats, $doors, [$minRate, $maxRate], $deposit, $features] = $spec;

        $brandId = $catalogue['brands'][$make] ?? null;
        $catalogueModel = $catalogue['models']["{$brandId}:{$model}"] ?? null;
        $variant = $catalogueModel?->variants->isNotEmpty() ? $catalogueModel->variants->random() : null;
        $colour = $catalogue['colours']->isNotEmpty() ? $catalogue['colours']->random() : null;
        $year = fake()->numberBetween(2015, 2025);
        $dailyRate = round(fake()->numberBetween($minRate, $maxRate), -2);
        $twoWheeler = in_array($catSlug, ['scooter', 'motorcycle', 'tuk-tuk'], true);
        $title = trim("{$make} {$model} " . ($variant?->name ?? '')) . " {$year}";

        $vehicle = Vehicle::create([
            'shop_id' => $shop->id,
            'category_id' => $catalogue['categories'][$catSlug] ?? $catalogue['categories']['car'],
            'brand_id' => $brandId,
            'model_id' => $catalogueModel?->id,
            'variant_id' => $variant?->id,
            'colour_id' => $colour?->id,
            'created_by' => $shop->owner_user_id,
            'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::lower(Str::random(6)),
            'make' => $make,
            'model' => $model,
            'variant' => $variant?->name,
            'year' => $year,
            'colour' => $colour?->name,
            'registration_number' => fake()->unique()->regexify('[A-Z]{2,3}-[0-9]{4}'),
            'transmission' => $transmission,
            'fuel_type' => $fuel,
            'seating_capacity' => $seats,
            'luggage_capacity' => $twoWheeler ? 0 : max(1, intdiv($seats, 2)),
            'doors' => $doors ?: null,
            'air_conditioned' => in_array('Air Conditioning', $features, true),
            'features' => $features,
            'description' => "Well-maintained {$year} {$make} {$model} from {$shop->name} in {$shop->city}. "
                . ($twoWheeler ? 'Perfect for getting around town and short coastal trips.' : 'Available for self-drive or with an experienced driver.'),
            'status' => Vehicle::STATUS_PUBLISHED,
            'moderation_status' => Vehicle::MODERATION_APPROVED,
            'published_at' => now()->subDays(fake()->numberBetween(1, 120)),
        ]);

        // About 1 in 12 demo vehicles is featured for the next 30 days (a granted promotion).
        if (fake()->boolean(8)) {
            Promotion::create([
                'reference_no' => 'PRM-DEMO-' . Str::upper(Str::random(6)), 'shop_id' => $shop->id,
                'type' => Promotion::TYPE_FEATURED, 'vehicle_id' => $vehicle->id, 'days' => 30, 'amount' => 0,
                'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED,
                'starts_at' => now(), 'ends_at' => now()->addDays(30), 'note' => 'Demo data', 'reviewed_at' => now(),
            ]);
        }

        VehiclePricing::create([
            'vehicle_id' => $vehicle->id,
            'daily_rate' => $dailyRate,
            'weekly_rate' => round($dailyRate * 6, -2),
            'monthly_rate' => round($dailyRate * 22, -2),
            'security_deposit' => $deposit,
            'deposit_method' => 'cash_on_pickup',
            'mileage_allowance_per_day_km' => fake()->randomElement([null, 100, 150, 200]),
            'excess_mileage_rate_per_km' => 30,
            'driver_rate_per_day' => $twoWheeler ? null : round($dailyRate * 0.4, -2),
            'delivery_available' => fake()->boolean(60),
            'delivery_free_radius_km' => 5,
            'delivery_fee_per_km' => 50,
            'cleaning_fee' => $twoWheeler ? 0 : 1000,
            'late_return_fee_per_hour' => round($dailyRate * 0.1, -2),
            'min_rental_days' => fake()->randomElement([1, 1, 1, 2, 3]),
            'advance_notice_hours' => fake()->randomElement([2, 4, 12, 24]),
            'updated_by' => $shop->owner_user_id,
        ]);

        if ($location) {
            VehiclePickupLocation::create([
                'vehicle_id' => $vehicle->id, 'location_id' => $location->id,
                'is_default' => true, 'delivery_allowed' => true,
            ]);
        }
    }

    protected function operatingHours(): array
    {
        $open = ['open' => fake()->randomElement(['07:00', '08:00', '08:30']), 'close' => fake()->randomElement(['18:00', '19:00', '20:00']), 'closed' => false];

        return [
            'mon' => $open, 'tue' => $open, 'wed' => $open, 'thu' => $open, 'fri' => $open,
            'sat' => $open,
            'sun' => ['open' => '09:00', 'close' => '14:00', 'closed' => fake()->boolean(30)],
        ];
    }
}
