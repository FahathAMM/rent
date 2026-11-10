<?php

namespace Tests\Feature;

use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The home page's "Browse by vehicle type" counts match what rental search would show. */
class PublicCategoryCountsTest extends TestCase
{
    use RefreshDatabase;

    private function vehicle(RentalShop $shop, VehicleCategory $category, array $overrides = []): Vehicle
    {
        return Vehicle::create($overrides + [
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Test Car',
            'listing_type' => Vehicle::LISTING_RENT,
            'slug' => 'test-car-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'AAA-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    public function test_counts_only_publicly_visible_rentals(): void
    {
        $car = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $van = VehicleCategory::create(['name' => 'Van', 'slug' => 'van', 'sort_order' => 2, 'is_active' => true]);
        $shop = RentalShop::factory()->create(['status' => 'active', 'is_published' => true]);
        $hiddenShop = RentalShop::factory()->create(['status' => 'active', 'is_published' => false]);

        $this->vehicle($shop, $car);
        $this->vehicle($shop, $car);
        $this->vehicle($shop, $car, ['listing_type' => Vehicle::LISTING_SALE]);
        $this->vehicle($shop, $car, ['status' => Vehicle::STATUS_DRAFT]);
        $this->vehicle($hiddenShop, $car);

        $counts = collect($this->getJson('/api/public/categories')->assertOk()->json('data'))->pluck('vehicles_count', 'slug');

        $this->assertSame(2, $counts['car']);
        $this->assertSame(0, $counts['van']);
    }
}
