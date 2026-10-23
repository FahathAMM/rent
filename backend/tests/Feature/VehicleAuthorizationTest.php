<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Support\ShopAbility;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Layer 3 of app-doc/marketplace/03-permissions-model.md: a shop member's
 * abilities (not just shop membership) gate what they may do. A staff
 * member can be a real, active member of the shop and still be denied a
 * specific action if their membership's `abilities` doesn't include it -
 * this is the check ShopScope alone cannot express.
 *
 * Uses real bearer tokens, not actingAs() - see ShopBoundaryTest's
 * docblock for why.
 */
class VehicleAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;
    private VehicleCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        ShopMember::create(['shop_id' => $this->shop->id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
    }

    private function as(User $user)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken);
    }

    private function payload(): array
    {
        return [
            'category_id' => $this->category->id, 'title' => 'New Car', 'make' => 'Toyota', 'model' => 'Aqua',
            'year' => 2021, 'registration_number' => 'ZZZ-' . rand(1000, 9999), 'transmission' => 'automatic',
            'fuel_type' => 'hybrid', 'seating_capacity' => 5,
        ];
    }

    public function test_owner_can_create_a_vehicle(): void
    {
        $this->as($this->shop->owner)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->postJson('/api/vehicles', $this->payload())
            ->assertCreated();
    }

    public function test_staff_without_listings_create_ability_is_denied(): void
    {
        $staff = User::factory()->create();
        ShopMember::create([
            'shop_id' => $this->shop->id, 'user_id' => $staff->id, 'role' => 'staff',
            'abilities' => ShopAbility::presetFor('staff'), // has listings.view, not listings.create
            'status' => 'active',
        ]);

        $this->as($staff)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->postJson('/api/vehicles', $this->payload())
            ->assertForbidden();
    }

    public function test_manager_with_listings_create_ability_succeeds(): void
    {
        $manager = User::factory()->create();
        ShopMember::create([
            'shop_id' => $this->shop->id, 'user_id' => $manager->id, 'role' => 'manager',
            'abilities' => ShopAbility::presetFor('manager'),
            'status' => 'active',
        ]);

        $this->as($manager)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->postJson('/api/vehicles', $this->payload())
            ->assertCreated();
    }

    public function test_staff_can_view_but_not_edit_pricing_without_the_ability(): void
    {
        $vehicle = Vehicle::create($this->payload() + [
            'shop_id' => $this->shop->id, 'slug' => 'staff-view-car',
            'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $staff = User::factory()->create();
        ShopMember::create([
            'shop_id' => $this->shop->id, 'user_id' => $staff->id, 'role' => 'staff',
            'abilities' => ShopAbility::presetFor('staff'), 'status' => 'active',
        ]);

        $this->as($staff)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->getJson("/api/vehicles/{$vehicle->id}")
            ->assertOk();

        $this->as($staff)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->putJson("/api/vehicles/{$vehicle->id}/pricing", ['daily_rate' => 5000])
            ->assertForbidden();
    }

    public function test_a_suspended_members_ability_grant_is_revoked(): void
    {
        $staff = User::factory()->create();
        ShopMember::create([
            'shop_id' => $this->shop->id, 'user_id' => $staff->id, 'role' => 'manager',
            'abilities' => ShopAbility::presetFor('manager'), 'status' => 'suspended',
        ]);

        $this->as($staff)
            ->withHeader('X-Shop-Id', (string) $this->shop->id)
            ->postJson('/api/vehicles', $this->payload())
            ->assertForbidden();
    }
}
