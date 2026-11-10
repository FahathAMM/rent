<?php

namespace Database\Seeders;

use App\Models\Administration\User;
use App\Models\Attachment;
use App\Models\Location;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleColour;
use App\Models\VehicleImage;
use App\Models\VehicleModel;
use App\Models\VehiclePickupLocation;
use App\Models\VehiclePricing;
use App\Models\VehicleSaleDetail;
use App\Services\SubscriptionService;
use Database\Seeders\Concerns\SeedsPasswords;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Production shop "F2-VIP Rental" — a verified, published shop on its free
 * trial with 10 published vehicles: 6 for rent and 4 for sale, each with
 * real photos.
 *
 * Vendor login (/vendor/login): fahath@ven.com / fahath — local/dev only.
 * In production the password is F2VIP_OWNER_PASSWORD, or a random one
 * printed once when that isn't set.
 *
 * Production-safe: no Faker (it's a dev dependency, absent after
 * `composer install --no-dev`), every value is fixed. The shop is skipped
 * if the owner email or the shop slug already exists, so it is safe to re-run.
 *
 * Photos come from Wikimedia Commons (free licences; each folder's
 * credits.json records title, author, licence and source). They are
 * downloaded once per model into the public disk under demo-vehicles/<model>/
 * and reused after that, so only the first run needs network access. With
 * no network the vehicles are left without photos — re-run later to add them
 * (vehicles that already have photos are skipped).
 *
 *   php artisan db:seed --class=F2VipRentalShopSeeder --force
 */
class F2VipRentalShopSeeder extends Seeder
{
    use SeedsPasswords;

    private const SHOP_NAME = 'F2-VIP Rental';
    private const EMAIL = 'fahath@ven.com';
    /** Local/dev only — production uses F2VIP_OWNER_PASSWORD or a random password (see SeedsPasswords). */
    private const DEV_PASSWORD = 'fahath';
    private const OWNER_NAME = 'Mohamed Fahath';
    private const PHONE = '0752388923';
    private const BUSINESS_REG_NO = '1111111';
    private const CITY = 'Sainthamaruthu';
    private const DISTRICT = 'Ampara';
    private const ADDRESS = 'Main Road';

    /** [make, model, category slug, transmission, fuel, seats, doors, year, colour, reg no, daily rate, deposit, features] */
    private const RENT = [
        ['Toyota', 'Aqua', 'car', 'automatic', 'hybrid', 5, 5, 2019, 'White', 'CAX-4521', 7000, 30000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Hybrid Fuel Saver']],
        ['Toyota', 'Premio', 'car', 'automatic', 'petrol', 5, 4, 2018, 'Silver', 'CAR-7783', 8500, 35000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Leather Seats']],
        ['Suzuki', 'Wagon R', 'car', 'automatic', 'petrol', 5, 5, 2020, 'Black', 'CBA-1290', 5500, 25000, ['Air Conditioning', 'Bluetooth', 'USB Charging']],
        ['Honda', 'Vezel', 'suv', 'automatic', 'hybrid', 5, 5, 2021, 'Pearl White', 'CBG-3364', 14000, 60000, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Cruise Control']],
        ['Mitsubishi', 'Montero', 'suv', 'automatic', 'diesel', 7, 5, 2017, 'Black', 'CAQ-8812', 19000, 75000, ['Air Conditioning', 'Bluetooth', '4WD', 'Reverse Camera']],
        ['Toyota', 'KDH', 'van', 'manual', 'diesel', 14, 4, 2016, 'White', 'PH-5521', 12500, 50000, ['Air Conditioning', 'Reclining Seats', 'Roof Rack']],
    ];

    /** [make, model, category slug, transmission, fuel, seats, doors, year, colour, reg no|null, engine cc, price LKR, negotiable, mileage km, condition, owners, warranty months|null, features] */
    private const SALE = [
        ['Toyota', 'Prius', 'car', 'automatic', 'hybrid', 5, 5, 2018, 'Silver', 'CAS-2047', 1800, 9850000, true, 74000, 'used', 2, null, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', 'Cruise Control']],
        ['Honda', 'Fit', 'car', 'automatic', 'hybrid', 5, 5, 2022, 'White', null, 1500, 8900000, true, 21000, 'reconditioned', 0, 6, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
        ['Nissan', 'X-Trail', 'suv', 'automatic', 'hybrid', 5, 5, 2020, 'Black', 'CBD-6631', 2000, 15750000, true, 48000, 'used', 1, null, ['Air Conditioning', 'Bluetooth', 'Reverse Camera', '4WD']],
        ['Suzuki', 'Swift', 'car', 'automatic', 'petrol', 5, 5, 2025, 'White', null, 1200, 8250000, false, 0, 'brand_new', 0, 36, ['Air Conditioning', 'Bluetooth', 'Reverse Camera']],
    ];

    private const PHOTO_DIR = 'demo-vehicles';
    private const PHOTOS_PER_MODEL = 5;
    private const PHOTOS_PER_VEHICLE = [3, 4];
    private const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

    /** Search terms where "<make> <model>" alone finds the wrong thing on Commons. */
    private const PHOTO_SEARCH = [
        'Toyota KDH' => 'Toyota HiAce H200',
    ];

    /** Commons files whose titles say they aren't a clean exterior shot. */
    private const SKIP_PHOTO_WORDS = [
        'interior', 'room', 'engine', 'dashboard', 'cockpit', 'seat', 'badge', 'emblem', 'logo',
        'wheel', 'rear view', 'trunk', 'boot', 'crash', 'wreck', 'accident', 'diagram', 'model car', 'toy',
    ];

    public function run(): void
    {
        $slug = Str::slug(self::SHOP_NAME);

        if (User::where('email', self::EMAIL)->exists() || RentalShop::where('slug', $slug)->exists()) {
            $this->command?->info(self::EMAIL . ' or shop "' . self::SHOP_NAME . '" already exists — skipping the shop.');
            $this->seedPhotos(RentalShop::where('slug', $slug)->value('id'));
            return;
        }

        $catalogue = [
            'categories' => VehicleCategory::pluck('id', 'slug'),
            'brands' => VehicleBrand::pluck('id', 'name'),
            'models' => VehicleModel::with('variants')->get()->keyBy(fn (VehicleModel $m) => "{$m->brand_id}:{$m->name}"),
            'colours' => VehicleColour::pluck('id', 'name'),
        ];

        if ($catalogue['categories']->isEmpty() || $catalogue['brands']->isEmpty()) {
            $this->command?->error('Vehicle catalogue is empty — run VehicleCategorySeeder and VehicleBrandSeeder first.');
            return;
        }

        $shop = DB::transaction(function () use ($slug, $catalogue) {
            $shop = $this->seedShop($slug);
            $location = Location::where('shop_id', $shop->id)->first();

            foreach (self::RENT as $spec) {
                $this->seedRentVehicle($shop, $location, $spec, $catalogue);
            }
            foreach (self::SALE as $spec) {
                $this->seedSaleVehicle($shop, $spec, $catalogue);
            }

            return $shop;
        });

        $this->command?->info('Seeded "' . self::SHOP_NAME . '" with ' . count(self::RENT) . ' rent and '
            . count(self::SALE) . ' sale vehicles. Vendor login: ' . self::EMAIL);

        // After the transaction — downloads can be slow and must not hold it open.
        $this->seedPhotos($shop->id);
    }

    private function seedShop(string $slug): RentalShop
    {
        $owner = User::create([
            'name' => self::OWNER_NAME,
            'email' => self::EMAIL,
            'password' => Hash::make($this->seedPassword('F2VIP_OWNER_PASSWORD', self::DEV_PASSWORD, 'F2-VIP owner ' . self::EMAIL)),
            'phone' => self::PHONE,
            'status' => User::STATUS_ACTIVE,
            'email_verified_at' => now(),
            'registration_source' => 'seeder',
        ]);
        $owner->assignRole('customer');

        $open = ['open' => '09:00', 'close' => '21:00', 'closed' => false];

        $shop = RentalShop::create([
            'owner_user_id' => $owner->id,
            'name' => self::SHOP_NAME,
            'slug' => $slug,
            'description' => self::SHOP_NAME . ' offers premium self-drive and chauffeur-driven vehicles in ' . self::CITY
                . ', plus quality cars for sale. Island-wide delivery available.',
            'tagline' => 'VIP rides, fair prices.',
            'email' => self::EMAIL,
            'phone' => self::PHONE,
            'whatsapp' => self::PHONE,
            'address_line_1' => self::ADDRESS,
            'city' => self::CITY,
            'district' => self::DISTRICT,
            'operating_hours' => [
                'mon' => $open, 'tue' => $open, 'wed' => $open, 'thu' => $open, 'fri' => $open, 'sat' => $open, 'sun' => $open,
            ],
            'policies' => RentalShop::DEFAULT_POLICIES,
            'business_registration_no' => self::BUSINESS_REG_NO,
            'status' => RentalShop::STATUS_ACTIVE,
            'verification_status' => RentalShop::VERIFICATION_VERIFIED,
            'verified_at' => now(),
            'is_published' => true,
            'published_at' => now(),
        ]);

        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole(User::SHOP_ROLE_OWNER);

        ShopSettings::createFor($shop->id);

        Location::create([
            'shop_id' => $shop->id, 'name' => self::SHOP_NAME . ' - Main Branch', 'type' => 'branch',
            'address' => self::ADDRESS . ', ' . self::CITY, 'city' => self::CITY, 'district' => self::DISTRICT,
            'country' => 'Sri Lanka', 'phone' => self::PHONE, 'is_active' => true,
        ]);

        // A shop with no plan has its vendor workspace locked — start the free trial.
        app(SubscriptionService::class)->startTrial($shop);

        return $shop;
    }

    private function seedRentVehicle(RentalShop $shop, ?Location $location, array $spec, array $catalogue): void
    {
        [$make, $model, $catSlug, $transmission, $fuel, $seats, $doors, $year, $colour, $regNo, $dailyRate, $deposit, $features] = $spec;

        $vehicle = $this->createVehicle($shop, Vehicle::LISTING_RENT, $catalogue, [
            $make, $model, $catSlug, $transmission, $fuel, $seats, $doors, $year, $colour, $regNo, null, $features,
        ], "Well-maintained {$year} {$make} {$model} from " . self::SHOP_NAME . ' in ' . self::CITY
            . '. Available for self-drive or with an experienced driver.');

        VehiclePricing::create([
            'vehicle_id' => $vehicle->id,
            'daily_rate' => $dailyRate,
            'weekly_rate' => round($dailyRate * 6, -2),
            'monthly_rate' => round($dailyRate * 22, -2),
            'security_deposit' => $deposit,
            'deposit_method' => 'cash_on_pickup',
            'mileage_allowance_per_day_km' => 150,
            'excess_mileage_rate_per_km' => 30,
            'driver_rate_per_day' => round($dailyRate * 0.4, -2),
            'delivery_available' => true,
            'delivery_free_radius_km' => 5,
            'delivery_fee_per_km' => 50,
            'cleaning_fee' => 1000,
            'late_return_fee_per_hour' => round($dailyRate * 0.1, -2),
            'min_rental_days' => 1,
            'advance_notice_hours' => 4,
            'updated_by' => $shop->owner_user_id,
        ]);

        if ($location) {
            VehiclePickupLocation::create([
                'vehicle_id' => $vehicle->id, 'location_id' => $location->id,
                'is_default' => true, 'delivery_allowed' => true,
            ]);
        }
    }

    private function seedSaleVehicle(RentalShop $shop, array $spec, array $catalogue): void
    {
        [$make, $model, $catSlug, $transmission, $fuel, $seats, $doors, $year, $colour, $regNo, $engineCc,
            $price, $negotiable, $mileage, $condition, $owners, $warranty, $features] = $spec;

        $lead = match ($condition) {
            'brand_new' => "Brand new {$year} {$make} {$model}, unregistered and ready for its first owner.",
            'reconditioned' => "Freshly imported, reconditioned {$year} {$make} {$model} with low mileage.",
            default => "Well-maintained {$year} {$make} {$model} with a full service history.",
        };

        $vehicle = $this->createVehicle($shop, Vehicle::LISTING_SALE, $catalogue, [
            $make, $model, $catSlug, $transmission, $fuel, $seats, $doors, $year, $colour, $regNo, $engineCc, $features,
        ], "{$lead} Available to view at " . self::SHOP_NAME . ' in ' . self::CITY . '. Leasing can be arranged.');

        VehicleSaleDetail::create([
            'vehicle_id' => $vehicle->id,
            'shop_id' => $shop->id,
            'price' => $price,
            'is_negotiable' => $negotiable,
            'mileage_km' => $mileage,
            'condition' => $condition,
            'owners_count' => $owners,
            'warranty_months' => $warranty,
            'sale_status' => VehicleSaleDetail::STATUS_AVAILABLE,
        ]);
    }

    private function createVehicle(RentalShop $shop, string $listingType, array $catalogue, array $spec, string $description): Vehicle
    {
        [$make, $model, $catSlug, $transmission, $fuel, $seats, $doors, $year, $colour, $regNo, $engineCc, $features] = $spec;

        $brandId = $catalogue['brands'][$make] ?? null;
        $catalogueModel = $catalogue['models']["{$brandId}:{$model}"] ?? null;
        $variant = $catalogueModel?->variants->first();
        $title = trim("{$make} {$model} " . ($variant?->name ?? '')) . " {$year}";

        return Vehicle::create([
            'shop_id' => $shop->id,
            'listing_type' => $listingType,
            'category_id' => $catalogue['categories'][$catSlug] ?? $catalogue['categories']['car'],
            'brand_id' => $brandId,
            'model_id' => $catalogueModel?->id,
            'variant_id' => $variant?->id,
            'colour_id' => $catalogue['colours'][$colour] ?? null,
            'created_by' => $shop->owner_user_id,
            'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::lower(Str::random(6)),
            'make' => $make,
            'model' => $model,
            'variant' => $variant?->name,
            'year' => $year,
            'colour' => $colour,
            'registration_number' => $regNo,
            'transmission' => $transmission,
            'fuel_type' => $fuel,
            'engine_capacity_cc' => $engineCc,
            'seating_capacity' => $seats,
            'luggage_capacity' => max(1, intdiv($seats, 2)),
            'doors' => $doors,
            'air_conditioned' => in_array('Air Conditioning', $features, true),
            'features' => $features,
            'description' => $description,
            'status' => Vehicle::STATUS_PUBLISHED,
            'moderation_status' => Vehicle::MODERATION_APPROVED,
            'published_at' => now(),
        ]);
    }

    /** Real photos for the shop's vehicles that have none yet; vehicles of the same model share the files. */
    private function seedPhotos(?int $shopId): void
    {
        if (!$shopId) {
            return;
        }

        $vehicles = Vehicle::where('shop_id', $shopId)->doesntHave('images')
            ->get(['id', 'shop_id', 'title', 'make', 'model', 'created_by']);
        if ($vehicles->isEmpty()) {
            return;
        }

        $attached = 0;
        $missing = [];

        foreach ($vehicles->groupBy(fn (Vehicle $v) => "{$v->make} {$v->model}") as $name => $group) {
            $photos = $this->photosFor($name);
            if (empty($photos)) {
                $missing[] = $name;
                continue;
            }

            foreach ($group as $vehicle) {
                $this->attachPhotos($vehicle, $photos);
                $attached++;
            }
        }

        $this->command?->info("Attached photos to {$attached} vehicles.");
        if ($missing) {
            $this->command?->warn('No photos found for: ' . implode(', ', $missing) . ' — re-run later to add them.');
        }
    }

    /** @return string[] public-disk paths for this model, downloading them on first use */
    private function photosFor(string $name): array
    {
        $disk = Storage::disk('public');
        $folder = self::PHOTO_DIR . '/' . Str::slug($name);

        $paths = collect($disk->files($folder))->filter(fn ($p) => str_ends_with($p, '.jpg'))->values()->all();
        if (count($paths) >= self::PHOTOS_PER_VEHICLE[0]) {
            return $paths;
        }

        // First run, or an earlier run was cut short (e.g. rate limited) — top up.
        $this->command?->line("  downloading photos for {$name}…");

        $credits = $disk->exists("{$folder}/credits.json") ? json_decode($disk->get("{$folder}/credits.json"), true) : [];
        $have = array_column($credits, 'title');
        $next = count($paths);

        foreach ($this->searchPhotos(self::PHOTO_SEARCH[$name] ?? $name, $name) as $file) {
            if (count($paths) >= self::PHOTOS_PER_MODEL) {
                break;
            }
            if (in_array($file['title'], $have, true) || !($body = $this->download($file['url']))) {
                continue;
            }

            $path = "{$folder}/" . (++$next) . '.jpg';
            $disk->put($path, $body);
            $paths[] = $path;
            $credits[] = ['file' => basename($path)] + array_diff_key($file, ['url' => true]);
        }

        if ($credits) {
            $disk->put("{$folder}/credits.json", json_encode($credits, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return $paths;
    }

    /** Wikimedia rate-limits bursts of downloads (HTTP 429) — pace requests and back off when told to. */
    private function download(string $url): ?string
    {
        for ($attempt = 1; $attempt <= 4; $attempt++) {
            usleep(750_000);

            try {
                $response = Http::withHeaders(['User-Agent' => $this->userAgent()])->timeout(60)->get($url);
            } catch (\Throwable) {
                continue;
            }

            if ($response->successful()) {
                return $response->body();
            }
            if ($response->status() !== 429) {
                return null;
            }

            sleep(max((int) $response->header('Retry-After'), 5 * $attempt));
        }

        return null;
    }

    /** @return array<int, array{url: string, title: string, author: ?string, license: ?string, source: ?string}> */
    private function searchPhotos(string $query, string $name): array
    {
        try {
            $response = Http::withHeaders(['User-Agent' => $this->userAgent()])->timeout(30)->get(self::COMMONS_API, [
                'action' => 'query',
                'format' => 'json',
                'generator' => 'search',
                'gsrnamespace' => 6,
                'gsrsearch' => "{$query} filetype:bitmap",
                'gsrlimit' => 30,
                'prop' => 'imageinfo',
                'iiprop' => 'url|mime|size|extmetadata',
                'iiurlwidth' => 1200,
            ]);
        } catch (\Throwable $e) {
            $this->command?->warn("  photo search failed for {$name}: {$e->getMessage()}");
            return [];
        }

        // Whole words only — a plain substring check on "toy" would drop every "Toyota".
        $skip = '/\b(' . implode('|', array_map(fn ($w) => preg_quote($w, '/'), self::SKIP_PHOTO_WORDS)) . ')\b/i';

        $candidates = collect($response->json('query.pages', []))->sortBy('index')->map(function (array $page) use ($skip) {
            $info = $page['imageinfo'][0] ?? null;
            // Landscape JPEGs at least 800px wide only.
            if (!$info || $info['mime'] !== 'image/jpeg' || ($info['width'] ?? 0) < ($info['height'] ?? 0) * 1.2 || ($info['width'] ?? 0) < 800) {
                return null;
            }

            $title = Str::of($page['title'])->after('File:')->beforeLast('.')->toString();
            if (preg_match($skip, $title)) {
                return null;
            }

            $meta = $info['extmetadata'] ?? [];

            return [
                'url' => $info['thumburl'] ?? $info['url'],
                'title' => $title,
                'author' => isset($meta['Artist']['value']) ? trim(strip_tags($meta['Artist']['value'])) : null,
                'license' => $meta['LicenseShortName']['value'] ?? null,
                'source' => $info['descriptionurl'] ?? null,
            ];
        })->filter()->values();

        // Prefer files actually named after the model (search also returns its siblings).
        $keyword = Str::lower(Str::of($name)->after(' ')->explode(' ')->first());
        $named = $candidates->filter(fn ($c) => Str::contains(Str::lower($c['title']), $keyword));

        return ($named->count() >= 2 ? $named : $candidates)->take(self::PHOTOS_PER_MODEL)->values()->all();
    }

    private function attachPhotos(Vehicle $vehicle, array $photos): void
    {
        $picked = collect($photos)->shuffle()->take(random_int(...self::PHOTOS_PER_VEHICLE))->values();
        $disk = Storage::disk('public');

        foreach ($picked as $i => $path) {
            $attachment = Attachment::create([
                'shop_id' => $vehicle->shop_id,
                'uploaded_by' => $vehicle->created_by,
                'file_name' => Str::slug($vehicle->title) . '-' . ($i + 1) . '.jpg',
                'file_path' => $path,
                'disk' => 'public',
                'mime_type' => 'image/jpeg',
                'file_size' => $disk->size($path),
                'attachable_type' => 'vehicle',
                'attachable_id' => $vehicle->id,
                'visibility' => Attachment::VISIBILITY_PUBLIC,
            ]);

            VehicleImage::create([
                'vehicle_id' => $vehicle->id,
                'attachment_id' => $attachment->id,
                'sort_order' => $i + 1,
                'is_primary' => $i === 0,
                'alt_text' => $vehicle->title,
            ]);
        }
    }

    private function userAgent(): string
    {
        // Wikimedia throttles generic agents harder — name the tool, per
        // https://meta.wikimedia.org/wiki/User-Agent_policy
        return Str::studly(config('app.name', 'Laravel')) . 'DemoSeeder/1.0 (demo data seeding; ' . config('app.url') . ')';
    }
}
