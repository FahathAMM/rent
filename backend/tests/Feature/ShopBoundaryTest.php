<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Locks in Layer 2 of app-doc/marketplace/03-permissions-model.md: the
 * active shop is ONLY the caller's own (users.shop_id), ShopScope
 * filters every shop-owned query to it, and a cross-shop id 404s rather
 * than leaking.
 *
 * Every request here authenticates via a REAL bearer token, never
 * actingAs() - see PlatformImpersonationTest for why: actingAs() does not
 * faithfully simulate Sanctum's per-guard token resolution, and a test
 * written against it can pass or fail for reasons that have nothing to
 * do with the code under test. This file itself caught exactly that: an
 * earlier actingAs()-based version of this same test produced a false
 * failure that led to hardening ShopScope's platform-admin check from a
 * bare auth('platform')->check() to an explicit `instanceof SystemAdmin`
 * check - real improvement, found via a flawed test, now fixed on both
 * sides.
 */
class ShopBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shopA;
    private RentalShop $shopB;
    private User $ownerA;
    private Vehicle $vehicleA;
    private Vehicle $vehicleB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\MenuSeeder::class); // shop-owner permissions

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);

        $this->ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $this->shopA = RentalShop::factory()->create(['owner_user_id' => $this->ownerA->id]);
        $this->shopB = RentalShop::factory()->create(['owner_user_id' => $ownerB->id]);

        $this->ownerA->update(['shop_id' => $this->shopA->id]);
        $ownerB->update(['shop_id' => $this->shopB->id]);
        $this->ownerA->setShopRole('owner');
        $ownerB->setShopRole('owner');

        $this->vehicleA = Vehicle::create([
            'shop_id' => $this->shopA->id, 'category_id' => $category->id, 'title' => 'Shop A Car',
            'slug' => 'shop-a-car', 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'AAA-0001', 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->vehicleB = Vehicle::create([
            'shop_id' => $this->shopB->id, 'category_id' => $category->id, 'title' => 'Shop B Car',
            'slug' => 'shop-b-car', 'make' => 'Toyota', 'model' => 'Premio', 'year' => 2020,
            'registration_number' => 'BBB-0001', 'transmission' => 'automatic', 'fuel_type' => 'petrol',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    private function as(User $user)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->tokenFor($user));
    }

    public function test_owner_can_view_their_own_vehicle_via_implicit_route_binding(): void
    {
        $this->as($this->ownerA)
            ->getJson("/api/vehicles/{$this->vehicleA->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $this->vehicleA->id);
    }

    public function test_cross_shop_vehicle_id_404s_instead_of_leaking(): void
    {
        $this->as($this->ownerA)
            ->getJson("/api/vehicles/{$this->vehicleB->id}")
            ->assertNotFound();
    }

    public function test_a_forged_x_shop_id_header_cannot_switch_to_another_shop(): void
    {
        $this->as($this->ownerA)
            ->withHeader('X-Shop-Id', (string) $this->shopB->id)
            ->getJson('/api/vehicles')
            ->assertOk()
            ->assertJsonMissing(['id' => $this->vehicleB->id])
            ->assertJsonFragment(['id' => $this->vehicleA->id]);
    }

    public function test_a_user_without_a_shop_is_rejected(): void
    {
        $this->as(User::factory()->create())
            ->getJson('/api/vehicles')
            ->assertForbidden();
    }

    public function test_the_users_own_shop_is_used_without_any_header(): void
    {
        $this->as($this->ownerA)
            ->getJson('/api/vehicles')
            ->assertOk();
    }

    public function test_a_suspended_shops_members_are_locked_out(): void
    {
        $this->shopA->update(['status' => 'suspended']);

        $this->as($this->ownerA)
            ->getJson('/api/vehicles')
            ->assertForbidden();
    }

    public function test_unauthenticated_request_to_a_vendor_route_is_rejected(): void
    {
        $this->getJson('/api/vehicles')->assertUnauthorized();
    }
}
