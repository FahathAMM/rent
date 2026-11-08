<?php

namespace Database\Seeders;

use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use Database\Seeders\Backup\MarketplaceDemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Five published cars for the Buy page (non-production only, see
 * DatabaseSeeder), spread one per shop across the verified demo shops. Kept
 * apart from DemoSeeder, which skips once any shop exists, so this can be
 * added to an already seeded database. Skips if any sale listing exists.
 * Photos: DemoVehiclePhotoSeeder.
 *
 *   php artisan db:seed --class=DemoSaleVehicleSeeder
 *   php artisan db:seed --class=DemoVehiclePhotoSeeder
 */
class DemoSaleVehicleSeeder extends MarketplaceDemoSeeder
{
    /** [make, model (both as in FLEET), year, engine cc, price LKR, negotiable, mileage km, condition, owners, warranty months] */
    private const LISTINGS = [
        ['Toyota', 'Aqua', 2019, 1500, 7850000, true, 62000, 'used', 2, null],
        ['Honda', 'Vezel', 2023, 1500, 13900000, true, 18000, 'reconditioned', 0, 6],
        ['Suzuki', 'Wagon R', 2025, 660, 7250000, false, 0, 'brand_new', 0, 36],
        ['Toyota', 'Hilux', 2021, 2400, 16500000, true, 85000, 'used', 1, null],
        ['Toyota', 'Land Cruiser Prado', 2017, 2800, 34500000, true, 98000, 'used', 2, null],
    ];

    public function run(): void
    {
        if (Vehicle::forSale()->exists()) {
            $this->command?->info('Sale listings already present — skipping.');
            return;
        }

        $shops = RentalShop::where('status', RentalShop::STATUS_ACTIVE)
            ->where('is_published', true)
            ->where('verification_status', RentalShop::VERIFICATION_VERIFIED)
            ->orderBy('id')
            ->get();

        if ($shops->isEmpty()) {
            $this->command?->warn('No verified shops to list sale vehicles under — skipping.');
            return;
        }

        $catalogue = $this->catalogue();

        DB::transaction(function () use ($shops, $catalogue) {
            foreach (self::LISTINGS as $i => $listing) {
                $this->seedListing($shops[$i % $shops->count()], $listing, $catalogue);
            }
        });

        $this->command?->info('Seeded ' . count(self::LISTINGS) . ' sale vehicles.');
    }

    private function seedListing(RentalShop $shop, array $listing, array $catalogue): void
    {
        [$make, $model, $year, $engineCc, $price, $negotiable, $mileage, $condition, $owners, $warranty] = $listing;
        [, , $catSlug, $transmission, $fuel, $seats, $doors, , , $features] = collect(static::FLEET)
            ->first(fn (array $spec) => $spec[0] === $make && $spec[1] === $model);

        $brandId = $catalogue['brands'][$make] ?? null;
        $catalogueModel = $catalogue['models']["{$brandId}:{$model}"] ?? null;
        $variant = $catalogueModel?->variants->isNotEmpty() ? $catalogueModel->variants->random() : null;
        $colour = $catalogue['colours']->isNotEmpty() ? $catalogue['colours']->random() : null;
        $title = trim("{$make} {$model} " . ($variant?->name ?? '')) . " {$year}";

        $vehicle = Vehicle::create([
            'shop_id' => $shop->id,
            'listing_type' => Vehicle::LISTING_SALE,
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
            // Only a used car must have a number; a new or reconditioned one may not be registered yet.
            'registration_number' => $condition === 'used' ? fake()->unique()->regexify('[A-Z]{2,3}-[0-9]{4}') : null,
            'transmission' => $transmission,
            'fuel_type' => $fuel,
            'engine_capacity_cc' => $engineCc,
            'seating_capacity' => $seats,
            'luggage_capacity' => max(1, intdiv($seats, 2)),
            'doors' => $doors,
            'air_conditioned' => in_array('Air Conditioning', $features, true),
            'features' => $features,
            'description' => $this->description($condition, $year, "{$make} {$model}", $shop),
            'status' => Vehicle::STATUS_PUBLISHED,
            'moderation_status' => Vehicle::MODERATION_APPROVED,
            'published_at' => now()->subDays(fake()->numberBetween(1, 30)),
        ]);

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

    private function description(string $condition, int $year, string $name, RentalShop $shop): string
    {
        $lead = match ($condition) {
            'brand_new' => "Brand new {$year} {$name}, unregistered and ready for its first owner.",
            'reconditioned' => "Freshly imported, reconditioned {$year} {$name} with low mileage.",
            default => "Well-maintained {$year} {$name} with a full service history.",
        };

        return "{$lead} Available to view at {$shop->name} in {$shop->city}. Leasing can be arranged.";
    }
}
