<?php

namespace Tests\Feature;

use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The /public/shops directory: filters, fleet stats and pagination meta.
 * Fleet stats must only count publicly visible vehicles - a draft listing
 * should never inflate a shop's count or undercut its "from" price.
 */
class PublicShopDirectoryTest extends TestCase
{
    use RefreshDatabase;

    private VehicleCategory $car;
    private VehicleCategory $van;

    protected function setUp(): void
    {
        parent::setUp();
        $this->car = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->van = VehicleCategory::create(['name' => 'Van', 'slug' => 'van', 'sort_order' => 2, 'is_active' => true]);
    }

    private function vehicle(RentalShop $shop, VehicleCategory $category, float $rate, bool $published = true, bool $delivery = false): Vehicle
    {
        $slug = 'v-' . fake()->unique()->numerify('#####');
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => $slug, 'slug' => $slug,
            'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2021, 'registration_number' => strtoupper($slug),
            'transmission' => 'automatic', 'fuel_type' => 'hybrid', 'seating_capacity' => 5,
            'status' => $published ? Vehicle::STATUS_PUBLISHED : 'draft',
            'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create(['vehicle_id' => $vehicle->id, 'daily_rate' => $rate, 'delivery_available' => $delivery]);

        return $vehicle;
    }

    public function test_listing_includes_fleet_stats_from_visible_vehicles_only(): void
    {
        $shop = RentalShop::factory()->create();
        $this->vehicle($shop, $this->car, 8000);
        $this->vehicle($shop, $this->van, 12000);
        $this->vehicle($shop, $this->car, 1000, published: false);

        $res = $this->getJson('/api/public/shops')->assertOk();

        $res->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.vehicles_count', 2)
            ->assertJsonPath('data.0.starting_daily_rate', 8000)
            ->assertJsonPath('data.0.categories', ['Car', 'Van']);
    }

    public function test_category_and_delivery_filters_match_on_visible_vehicles(): void
    {
        $vanShop = RentalShop::factory()->create();
        $this->vehicle($vanShop, $this->van, 12000, delivery: true);
        $carShop = RentalShop::factory()->create();
        $this->vehicle($carShop, $this->car, 8000);
        $this->vehicle($carShop, $this->van, 9000, published: false, delivery: true);

        $this->getJson('/api/public/shops?category_id=' . $this->van->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $vanShop->id);

        $this->getJson('/api/public/shops?delivery=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $vanShop->id);
    }

    public function test_fleet_sort_orders_by_visible_vehicle_count(): void
    {
        $small = RentalShop::factory()->create();
        $this->vehicle($small, $this->car, 5000);
        $big = RentalShop::factory()->create();
        $this->vehicle($big, $this->car, 5000);
        $this->vehicle($big, $this->van, 7000);

        $this->getJson('/api/public/shops?sort=fleet')
            ->assertOk()->assertJsonPath('data.0.id', $big->id)->assertJsonPath('data.1.id', $small->id);
    }

    public function test_shop_profile_includes_fleet_stats_and_vehicles_filter_by_category(): void
    {
        $shop = RentalShop::factory()->create();
        $this->vehicle($shop, $this->car, 8000);
        $this->vehicle($shop, $this->van, 12000);

        $this->getJson("/api/public/shops/{$shop->slug}")
            ->assertOk()->assertJsonPath('data.vehicles_count', 2)->assertJsonPath('data.categories', ['Car', 'Van']);

        $this->getJson("/api/public/shops/{$shop->slug}/vehicles?category_id={$this->van->id}")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
    }

    public function test_shop_reviews_returns_empty_distribution_when_no_reviews(): void
    {
        $shop = RentalShop::factory()->create();

        $this->getJson("/api/public/shops/{$shop->slug}/reviews")
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('meta.distribution.5', 0);
    }
}
