<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The platform's shop detail page payload — counts, team, locations and recent vehicles alongside the shop itself. */
class PlatformShopDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_shop_detail_includes_stats_team_and_recent_vehicles(): void
    {
        $this->seed(MenuSeeder::class);
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole(User::SHOP_ROLE_OWNER);

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        foreach ([Vehicle::STATUS_PUBLISHED, Vehicle::STATUS_DRAFT] as $i => $status) {
            Vehicle::create([
                'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => "Car {$i}",
                'slug' => "car-{$i}-" . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
                'registration_number' => 'CAR-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
                'seating_capacity' => 5, 'status' => $status,
            ]);
        }

        $admin = SystemAdmin::factory()->create();
        $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)
            ->getJson("/api/platform/shops/{$shop->id}")
            ->assertOk()
            ->assertJsonPath('data.vehicles_count', 2)
            ->assertJsonPath('data.published_vehicles_count', 1)
            ->assertJsonPath('data.open_bookings_count', 0)
            ->assertJsonCount(2, 'data.recent_vehicles')
            ->assertJsonPath('data.members.0.email', $owner->email)
            ->assertJsonPath('data.members.0.shop_role_label', $owner->fresh()->shopRoleLabel());
    }
}
