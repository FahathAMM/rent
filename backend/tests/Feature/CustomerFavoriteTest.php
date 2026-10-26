<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Favorites persist per customer: what /favorites/ids returns is what the
 * vehicle page uses to show the heart after a refresh. Real customer
 * bearer tokens (the customer guard), never actingAs().
 */
class CustomerFavoriteTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $shop = RentalShop::factory()->create(['owner_user_id' => User::factory()->create()->id]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Fav Car', 'slug' => 'fav-car',
            'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020, 'registration_number' => 'FAV-0001',
            'transmission' => 'automatic', 'fuel_type' => 'hybrid', 'seating_capacity' => 5,
            'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function as(Customer $customer)
    {
        // The test app is one long-lived instance, so a guard keeps the first
        // customer it resolved. Real requests each start fresh - mirror that.
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $customer->createToken('test')->plainTextToken);
    }

    public function test_a_saved_favorite_is_returned_by_ids_until_removed(): void
    {
        $customer = Customer::factory()->create();

        $this->as($customer)->getJson('/api/favorites/ids')->assertOk()->assertExactJson(['data' => []]);

        $this->as($customer)->postJson("/api/favorites/{$this->vehicle->id}")->assertCreated();
        // Saving twice is harmless (firstOrCreate) - the heart can't double up.
        $this->as($customer)->postJson("/api/favorites/{$this->vehicle->id}")->assertCreated();

        $this->as($customer)->getJson('/api/favorites/ids')->assertOk()->assertExactJson(['data' => [$this->vehicle->id]]);

        $this->as($customer)->deleteJson("/api/favorites/{$this->vehicle->id}")->assertOk();
        $this->as($customer)->getJson('/api/favorites/ids')->assertOk()->assertExactJson(['data' => []]);
    }

    public function test_ids_only_include_the_callers_own_favorites(): void
    {
        $alice = Customer::factory()->create();
        $bob = Customer::factory()->create();

        $this->as($alice)->postJson("/api/favorites/{$this->vehicle->id}")->assertCreated();

        $this->as($bob)->getJson('/api/favorites/ids')->assertOk()->assertExactJson(['data' => []]);
    }

    public function test_ids_require_a_customer_login(): void
    {
        $this->getJson('/api/favorites/ids')->assertUnauthorized();
    }
}
