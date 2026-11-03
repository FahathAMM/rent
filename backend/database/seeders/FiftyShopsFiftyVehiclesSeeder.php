<?php

namespace Database\Seeders;

use App\Models\Administration\User;
use App\Models\Attachment;
use App\Models\City;
use App\Models\District;
use App\Models\Location;
use App\Models\OwnerBankDetail;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleColour;
use App\Models\VehicleImage;
use App\Models\VehicleModel;
use App\Models\VehiclePickupLocation;
use App\Models\VehiclePricing;
use App\Support\ShopAbility;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Seeds 50 realistic Sri Lankan rental shops across various districts and cities,
 * with 5 distinct vehicles per shop (total 250 vehicles), complete with owner accounts,
 * bank details, branch locations, and comprehensive pricing models.
 */
class FiftyShopsFiftyVehiclesSeeder extends Seeder
{
    private const PASSWORD = 'password';

    /**
     * 50 Unique Business Name Themes
     */
    private const SHOP_PREFIXES = [
        'Lanka', 'Ceylon', 'Serendib', 'Royal', 'Silver', 'Golden', 'Island', 'Pinnacle',
        'Express', 'Prestige', 'Apex', 'Crown', 'Metro', 'Sunbird', 'Oceanic',
        'Emerald', 'Blue Sky', 'Pearl', 'Velocity', 'Heritage', 'Paradise', 'Horizon',
        'Prime', 'Regal', 'Southern', 'Hill Country', 'Kandurata', 'Ruhunu', 'Wayamba',
        'Rajarata', 'Sabara', 'Vajira', 'Breeze', 'Swift', 'Citywide', 'Greenline',
        'Capital', 'Coastline', 'Falcon', 'Galaxy', 'Grand', 'Legend', 'Lotus',
        'Majestic', 'Monarch', 'National', 'Navin', 'Paramount', 'Pioneer', 'Sunrise',
    ];

    private const SHOP_SUFFIXES = [
        'Rent A Car', 'Vehicle Rentals', 'Auto Hire', 'Car Rentals', 'Motors & Rentals',
        'Drive Solutions', 'Rentals & Tours', 'Cab & Rental Service',
    ];

    /**
     * Common Sri Lankan Owner Names
     */
    private const OWNER_FIRST_NAMES = [
        'Nuwan', 'Kasun', 'Dinesh', 'Ruwan', 'Chaminda', 'Sanjeewa', 'Pradeep', 'Roshan',
        'Mahesh', 'Tharindu', 'Lahiru', 'Sachith', 'Buddhika', 'Gayan', 'Indika',
        'Suresh', 'Niroshan', 'Asanka', 'Suranga', 'Chathura', 'Kavinda', 'Janaka',
        'Dimuthu', 'Hemantha', 'Sampath', 'Upul', 'Lalith', 'Sarath', 'Bandula', 'Mahinda',
        'Lakmal', 'Sumith', 'Ajith', 'Nalin', 'Prasanna', 'Ranjith', 'Anura', 'Manjula',
        'Thilak', 'Gamini', 'Sunil', 'Jayantha', 'Rohan', 'Priyantha', 'Kamal', 'Nimal',
        'Sisira', 'Ananda', 'Keerthi', 'Wasantha',
    ];

    private const OWNER_LAST_NAMES = [
        'Perera', 'Fernando', 'de Silva', 'Silva', 'Jayawardena', 'Bandara', 'Gunawardena',
        'Rajapaksa', 'Dissanayake', 'Wickramasinghe', 'Herath', 'Mendis', 'Alwis', 'Karunaratne',
        'Senanayake', 'Ranasinghe', 'Ekanayake', 'Liyanage', 'Abeywickrama', 'Jayasinghe',
        'Rathnayake', 'Samaraweera', 'Wijesinghe', 'Weerasinghe', 'Tennakoon', 'Ratnayake',
        'Amarasinghe', 'Gunaratne', 'Mallawarachchi', 'Attanayake', 'Pathirana', 'Bogoda',
        'Kaluarachchi', 'Gamage', 'Munasinghe', 'Edirisinghe', 'Seneviratne', 'Jayatillake',
    ];

    public function run(): void
    {
        $this->command?->info('Starting seeding of 50 rental shops with 5 vehicles each...');

        // Preload categories, brands, models, colours, and districts with cities
        $categories = VehicleCategory::pluck('id', 'slug');
        $brands = VehicleBrand::pluck('id', 'name');
        $models = VehicleModel::with('variants', 'brand')->get();
        $colours = VehicleColour::all();
        $districts = District::with('cities')->get()->filter(fn ($d) => $d->cities->isNotEmpty())->values();

        if ($districts->isEmpty() || $categories->isEmpty() || $models->isEmpty()) {
            $this->command?->error('Prerequisite seeders (categories, brands, locations) must be run first.');
            return;
        }

        DB::beginTransaction();

        try {
            $shopCount = 0;
            $vehicleCount = 0;

            for ($i = 0; $i < 50; $i++) {
                // Determine district and city
                $district = $districts[$i % $districts->count()];
                $city = $district->cities->random();

                // Generate unique shop name
                $prefix = self::SHOP_PREFIXES[$i];
                $suffix = self::SHOP_SUFFIXES[$i % count(self::SHOP_SUFFIXES)];
                $shopName = "{$prefix} {$suffix}";

                // Shop Owner
                $ownerFirstName = self::OWNER_FIRST_NAMES[$i % count(self::OWNER_FIRST_NAMES)];
                $ownerLastName = self::OWNER_LAST_NAMES[($i * 3) % count(self::OWNER_LAST_NAMES)];
                $ownerFullName = "{$ownerFirstName} {$ownerLastName}";
                $ownerEmail = Str::slug("{$ownerFirstName}.{$ownerLastName}.{$i}") . '@example.com';

                $owner = User::firstOrCreate(
                    ['email' => $ownerEmail],
                    [
                        'name' => $ownerFullName,
                        'password' => Hash::make(self::PASSWORD),
                        'phone' => '07' . fake()->unique()->numerify('########'),
                        'status' => User::STATUS_ACTIVE,
                        'email_verified_at' => now(),
                        'registration_source' => 'bulk_seeder',
                    ]
                );
                $owner->syncRoles(['customer', 'shop-owner']);

                // Create Rental Shop
                $shopSlug = Str::slug($shopName) . '-' . Str::lower(Str::random(5));
                $shopPhone = '0' . fake()->numerify('#########');

                $shop = RentalShop::create([
                    'owner_user_id' => $owner->id,
                    'name' => $shopName,
                    'slug' => $shopSlug,
                    'description' => "{$shopName} offers premium and budget vehicles in {$city->name}, {$district->name} District. Self-drive and chauffeur-driven packages available.",
                    'tagline' => 'Travel safely with verified rentals.',
                    'email' => $ownerEmail,
                    'phone' => $shopPhone,
                    'whatsapp' => $shopPhone,
                    'website' => 'https://' . Str::slug($shopName) . '.lk',
                    'address_line_1' => fake()->buildingNumber() . ', ' . fake()->streetName(),
                    'address_line_2' => $city->name,
                    'city' => $city->name,
                    'district' => $district->name,
                    'postal_code' => fake()->numerify('#####'),
                    'operating_hours' => $this->defaultOperatingHours(),
                    'policies' => RentalShop::DEFAULT_POLICIES,
                    'business_registration_no' => 'PV ' . fake()->unique()->numerify('########'),
                    'status' => RentalShop::STATUS_ACTIVE,
                    'verification_status' => RentalShop::VERIFICATION_VERIFIED,
                    'is_published' => true,
                    'published_at' => now()->subDays(rand(10, 180)),
                    'payout_schedule' => fake()->randomElement(['weekly', 'biweekly', 'monthly']),
                    'min_payout_threshold' => 5000,
                ]);

                // Create Shop Membership for Owner
                ShopMember::create([
                    'shop_id' => $shop->id,
                    'user_id' => $owner->id,
                    'role' => ShopMember::ROLE_OWNER,
                    'status' => ShopMember::STATUS_ACTIVE,
                    'accepted_at' => now(),
                ]);

                // Settings
                ShopSettings::createFor($shop->id);

                // Primary Bank Detail
                OwnerBankDetail::create([
                    'shop_id' => $shop->id,
                    'account_holder_name' => $ownerFullName,
                    'bank_name' => fake()->randomElement(['Commercial Bank', 'Sampath Bank', 'Hatton National Bank', 'Bank of Ceylon', 'People\'s Bank']),
                    'branch_name' => $city->name,
                    'account_number' => fake()->numerify('##########'),
                    'account_number_last4' => fake()->numerify('####'),
                    'account_type' => 'savings',
                    'is_primary' => true,
                    'verification_status' => 'verified',
                    'verified_at' => now(),
                ]);

                // Main Branch Location
                $branchLocation = Location::create([
                    'shop_id' => $shop->id,
                    'name' => "{$shop->name} - Main Office",
                    'type' => 'branch',
                    'address' => "{$shop->address_line_1}, {$shop->city}",
                    'city' => $city->name,
                    'district' => $district->name,
                    'country' => 'Sri Lanka',
                    'phone' => $shop->phone,
                    'is_active' => true,
                ]);

                // Seed 5 Vehicles for this Shop
                for ($v = 0; $v < 5; $v++) {
                    $vehicleModel = $models->random();
                    $brand = $vehicleModel->brand;
                    $variant = $vehicleModel->variants->isNotEmpty() ? $vehicleModel->variants->random() : null;
                    $colour = $colours->isNotEmpty() ? $colours->random() : null;

                    // Deduce matching category slug based on model/brand or fallback
                    $catSlug = $this->determineCategorySlug($vehicleModel->name, $categories);
                    $categoryId = $categories[$catSlug] ?? $categories->first();

                    $year = fake()->numberBetween(2018, 2025);
                    $title = "{$brand->name} {$vehicleModel->name} {$year} - {$city->name}";
                    $vSlug = Str::slug("{$title}-{$shop->id}-{$v}") . '-' . Str::lower(Str::random(5));

                    $transmission = in_array(strtolower($vehicleModel->name), ['kdh', 'hiace', 'alto', 'caravan', 'coaster'])
                        ? fake()->randomElement(['manual', 'automatic'])
                        : 'automatic';

                    $fuelType = in_array(strtolower($vehicleModel->name), ['aqua', 'prius', 'fit', 'vezel'])
                        ? 'hybrid'
                        : (in_array(strtolower($vehicleModel->name), ['kdh', 'hiace', 'caravan', 'montero', 'coaster', 'prado']) ? 'diesel' : 'petrol');

                    $seats = in_array(strtolower($vehicleModel->name), ['coaster']) ? 29
                        : (in_array(strtolower($vehicleModel->name), ['kdh', 'hiace', 'caravan']) ? 14
                        : (in_array(strtolower($vehicleModel->name), ['montero', 'prado', 'cr-v']) ? 7 : 5));

                    $dailyRate = $this->calculateDailyRate($catSlug, $year);
                    $securityDeposit = round($dailyRate * fake()->randomElement([3, 4, 5]), -3);

                    $vehicle = Vehicle::create([
                        'shop_id' => $shop->id,
                        'category_id' => $categoryId,
                        'brand_id' => $brand->id,
                        'model_id' => $vehicleModel->id,
                        'variant_id' => $variant?->id,
                        'colour_id' => $colour?->id,
                        'created_by' => $owner->id,
                        'title' => $title,
                        'slug' => $vSlug,
                        'make' => $brand->name,
                        'model' => $vehicleModel->name,
                        'variant' => $variant?->name,
                        'year' => $year,
                        'colour' => $colour?->name ?? 'White',
                        'registration_number' => fake()->unique()->regexify('[A-Z]{2,3}-[0-9]{4}'),
                        'transmission' => $transmission,
                        'fuel_type' => $fuelType,
                        'engine_capacity_cc' => $seats > 10 ? 2800 : ($seats > 5 ? 2000 : 1500),
                        'seating_capacity' => $seats,
                        'luggage_capacity' => max(1, intdiv($seats, 2)),
                        'doors' => $seats > 10 ? 4 : 5,
                        'air_conditioned' => true,
                        'features' => ['Air Conditioning', 'Power Steering', 'Bluetooth', 'Reverse Camera', 'ABS'],
                        'description' => "Well maintained and clean {$brand->name} {$vehicleModel->name} ({$year}) available from {$shop->name}. Full insurance cover included.",
                        'status' => Vehicle::STATUS_PUBLISHED,
                        'moderation_status' => Vehicle::MODERATION_APPROVED,
                        'published_at' => now()->subDays(rand(1, 90)),
                        'booking_count' => rand(0, 15),
                        'rating_avg' => round(fake()->randomFloat(2, 4.2, 5.0), 2),
                    ]);

                    // Pricing
                    VehiclePricing::create([
                        'vehicle_id' => $vehicle->id,
                        'currency' => 'LKR',
                        'daily_rate' => $dailyRate,
                        'weekly_rate' => round($dailyRate * 6.3, -2),
                        'monthly_rate' => round($dailyRate * 23, -2),
                        'security_deposit' => $securityDeposit,
                        'deposit_method' => 'cash_on_pickup',
                        'mileage_allowance_per_day_km' => 100,
                        'excess_mileage_rate_per_km' => round($dailyRate * 0.008, 0),
                        'driver_rate_per_day' => round($dailyRate * 0.45, -2),
                        'delivery_available' => true,
                        'delivery_free_radius_km' => 5,
                        'delivery_fee_per_km' => 60,
                        'delivery_flat_fee' => 1500,
                        'cleaning_fee' => 1000,
                        'late_return_fee_per_hour' => round($dailyRate * 0.1, -2),
                        'fuel_policy' => 'same_level',
                        'min_rental_days' => 1,
                        'max_rental_days' => 60,
                        'advance_notice_hours' => 3,
                        'tax_rate' => 0.00,
                        'updated_by' => $owner->id,
                    ]);

                    // Pickup Location link
                    VehiclePickupLocation::create([
                        'vehicle_id' => $vehicle->id,
                        'location_id' => $branchLocation->id,
                        'is_default' => true,
                        'delivery_allowed' => true,
                    ]);

                    // Attach Real Vehicle Image
                    $this->attachVehicleImage($vehicle, $catSlug, $owner->id);

                    $vehicleCount++;
                }

                $shopCount++;
            }

            DB::commit();

            $this->command?->info("Successfully seeded {$shopCount} shops and {$vehicleCount} vehicles!");
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->command?->error("Failed seeding shops: " . $e->getMessage());
            throw $e;
        }
    }

    private function determineCategorySlug(string $modelName, $categories): string
    {
        $name = strtolower($modelName);

        if (str_contains($name, 'kdh') || str_contains($name, 'hiace') || str_contains($name, 'caravan') || str_contains($name, 'every')) {
            return isset($categories['van']) ? 'van' : 'car';
        }
        if (str_contains($name, 'coaster') || str_contains($name, 'bus')) {
            return isset($categories['minibus']) ? 'minibus' : 'van';
        }
        if (str_contains($name, 'montero') || str_contains($name, 'prado') || str_contains($name, 'vezel') || str_contains($name, 'outlander') || str_contains($name, 'cx-5') || str_contains($name, 'tucson') || str_contains($name, 'sportage') || str_contains($name, 'cr-v')) {
            return isset($categories['suv']) ? 'suv' : 'car';
        }
        if (str_contains($name, 'three-wheeler') || str_contains($name, 'king')) {
            return isset($categories['tuk-tuk']) ? 'tuk-tuk' : 'car';
        }
        if (str_contains($name, 'pulsar') || str_contains($name, 'apache') || str_contains($name, 'fz') || str_contains($name, 'splendor')) {
            return isset($categories['motorcycle']) ? 'motorcycle' : 'car';
        }
        if (str_contains($name, 'ntorq') || str_contains($name, 'ray zr') || str_contains($name, 'pleasure')) {
            return isset($categories['scooter']) ? 'scooter' : 'car';
        }
        if (str_contains($name, 'd-max') || str_contains($name, 'hilux') || str_contains($name, 'bolero') || str_contains($name, 'dost')) {
            return isset($categories['pickup-lorry']) ? 'pickup-lorry' : 'car';
        }

        return 'car';
    }

    private function calculateDailyRate(string $categorySlug, int $year): float
    {
        $base = match ($categorySlug) {
            'tuk-tuk' => 2500,
            'scooter' => 2000,
            'motorcycle' => 2800,
            'van' => 12500,
            'minibus' => 24000,
            'suv' => 16000,
            'pickup-lorry' => 11000,
            'luxury', 'wedding-car' => 28000,
            default => 6500, // car
        };

        // Newer vehicles cost slightly more
        $yearModifier = ($year - 2018) * 400;

        return max(2000, round($base + $yearModifier, -2));
    }

    private function defaultOperatingHours(): array
    {
        $open = ['open' => '08:00', 'close' => '18:00', 'closed' => false];

        return [
            'mon' => $open,
            'tue' => $open,
            'wed' => $open,
            'thu' => $open,
            'fri' => $open,
            'sat' => $open,
            'sun' => ['open' => '09:00', 'close' => '14:00', 'closed' => false],
        ];
    }

    private function attachVehicleImage(Vehicle $vehicle, string $catSlug, int $ownerId): void
    {
        $assetDir = storage_path('app/public/seed-assets/vehicles/');
        if (!is_dir($assetDir)) {
            return;
        }

        $categoryAssetMap = [
            'car' => ['car_sedan.jpg', 'car_white.jpg', 'car_red.jpg', 'car_black.jpg', 'car_bmw.jpg', 'car_audi.jpg'],
            'suv' => ['suv_grey.jpg', 'suv_merc.jpg'],
            'van' => ['van_travel.jpg', 'van_minibus.jpg'],
            'minibus' => ['van_minibus.jpg', 'van_travel.jpg'],
            'bus' => ['van_minibus.jpg'],
            'tuk-tuk' => ['tuktuk.jpg'],
            'motorcycle' => ['motorcycle.jpg'],
            'scooter' => ['scooter.jpg'],
            'pickup-lorry' => ['pickup_truck.jpg'],
            'luxury' => ['luxury_car.jpg', 'car_bmw.jpg', 'car_audi.jpg', 'suv_merc.jpg'],
            'wedding-car' => ['car_white.jpg', 'car_sedan.jpg', 'luxury_car.jpg'],
            'self-drive' => ['car_white.jpg', 'car_sedan.jpg', 'car_red.jpg', 'car_black.jpg'],
        ];

        $options = $categoryAssetMap[$catSlug] ?? $categoryAssetMap['car'];
        $chosenAsset = $options[array_rand($options)];
        $sourceFile = $assetDir . $chosenAsset;

        if (!file_exists($sourceFile)) {
            return;
        }

        $destFolder = "vehicles/{$vehicle->id}";
        $destFullPath = storage_path("app/public/{$destFolder}");
        if (!is_dir($destFullPath)) {
            mkdir($destFullPath, 0755, true);
        }

        $destFileName = Str::random(40) . '.jpg';
        $destRelativePath = "{$destFolder}/{$destFileName}";

        copy($sourceFile, storage_path("app/public/{$destRelativePath}"));

        $attachment = Attachment::create([
            'shop_id' => $vehicle->shop_id,
            'uploaded_by' => $ownerId,
            'file_name' => $chosenAsset,
            'file_path' => $destRelativePath,
            'disk' => 'public',
            'mime_type' => 'image/jpeg',
            'file_size' => filesize($sourceFile),
            'attachable_type' => 'vehicle',
            'attachable_id' => $vehicle->id,
            'visibility' => Attachment::VISIBILITY_PUBLIC,
        ]);

        VehicleImage::create([
            'vehicle_id' => $vehicle->id,
            'attachment_id' => $attachment->id,
            'sort_order' => 1,
            'is_primary' => true,
            'alt_text' => $vehicle->title,
        ]);
    }
}
