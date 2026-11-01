<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleColour;
use App\Models\VehicleModel;
use App\Models\VehicleVariant;
use Database\Seeders\MenuSeeder;
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
    private VehicleBrand $brand;
    private VehicleModel $model;
    private VehicleVariant $variant;
    private VehicleColour $colour;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class); // vendor permissions

        $this->category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->brand = VehicleBrand::create(['name' => 'Toyota', 'slug' => 'toyota', 'is_active' => true]);
        $this->model = VehicleModel::create(['brand_id' => $this->brand->id, 'name' => 'Aqua', 'slug' => 'aqua', 'is_active' => true]);
        $this->variant = VehicleVariant::create(['model_id' => $this->model->id, 'name' => 'G', 'is_active' => true]);
        $this->colour = VehicleColour::create(['name' => 'White', 'slug' => 'white', 'hex' => '#FFFFFF', 'is_active' => true]);
        $owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $this->shop->id]);
        $owner->setShopRole('owner');
    }

    private function as(User $user)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken);
    }

    private function payload(): array
    {
        return [
            'category_id' => $this->category->id, 'brand_id' => $this->brand->id, 'model_id' => $this->model->id, 'title' => 'New Car', 'make' => 'Toyota', 'model' => 'Aqua',
            'year' => 2021, 'registration_number' => 'ZZZ-' . rand(1000, 9999), 'transmission' => 'automatic',
            'fuel_type' => 'hybrid', 'seating_capacity' => 5,
        ];
    }

    public function test_owner_can_create_a_vehicle(): void
    {
        $this->as($this->shop->owner)
            ->postJson('/api/vehicles', $this->payload())
            ->assertCreated();
    }

    /**
     * The add-vehicle form sends every pricing field, optional ones as ""
     * (-> null). NOT NULL columns like security_deposit must fall back to
     * their defaults instead of failing the insert.
     */
    public function test_pricing_saves_with_optional_fields_left_empty(): void
    {
        $id = $this->as($this->shop->owner)
            ->postJson('/api/vehicles', $this->payload())
            ->assertCreated()
            ->json('data.id');

        $this->as($this->shop->owner)
            ->putJson("/api/vehicles/{$id}/pricing", [
                'daily_rate' => '5500',
                'weekly_rate' => '', 'monthly_rate' => '', 'security_deposit' => '',
                'deposit_method' => 'cash_on_pickup', 'mileage_allowance_per_day_km' => '',
                'driver_rate_per_day' => '', 'delivery_available' => false, 'min_rental_days' => '',
            ])
            ->assertOk();

        $this->assertDatabaseHas('vehicle_pricing', [
            'vehicle_id' => $id, 'daily_rate' => 5500, 'security_deposit' => 0, 'min_rental_days' => 1,
        ]);
    }

    public function test_make_model_variant_and_colour_names_come_from_the_catalogue_not_the_request(): void
    {
        $this->as($this->shop->owner)
            ->postJson('/api/vehicles', [
                'make' => 'Typo Motors', 'model' => 'Aqqua',
                'variant_id' => $this->variant->id, 'colour_id' => $this->colour->id,
            ] + $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.brand_id', $this->brand->id)
            ->assertJsonPath('data.make', 'Toyota')
            ->assertJsonPath('data.model', 'Aqua')
            ->assertJsonPath('data.variant', 'G')
            ->assertJsonPath('data.colour', 'White');
    }

    public function test_a_model_from_another_brand_is_rejected(): void
    {
        $suzuki = VehicleBrand::create(['name' => 'Suzuki', 'slug' => 'suzuki', 'is_active' => true]);
        $alto = VehicleModel::create(['brand_id' => $suzuki->id, 'name' => 'Alto', 'slug' => 'alto', 'is_active' => true]);

        $this->as($this->shop->owner)
            ->postJson('/api/vehicles', ['model_id' => $alto->id] + $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('model_id');
    }

    public function test_a_variant_from_another_model_is_rejected(): void
    {
        $premio = VehicleModel::create(['brand_id' => $this->brand->id, 'name' => 'Premio', 'slug' => 'premio', 'is_active' => true]);
        $premioX = VehicleVariant::create(['model_id' => $premio->id, 'name' => 'X', 'is_active' => true]);

        $this->as($this->shop->owner)
            ->postJson('/api/vehicles', ['variant_id' => $premioX->id] + $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('variant_id');
    }

    public function test_changing_the_model_drops_a_variant_that_belonged_to_the_old_one(): void
    {
        $created = $this->as($this->shop->owner)
            ->postJson('/api/vehicles', ['variant_id' => $this->variant->id] + $this->payload())
            ->assertCreated();

        $premio = VehicleModel::create(['brand_id' => $this->brand->id, 'name' => 'Premio', 'slug' => 'premio', 'is_active' => true]);

        $this->as($this->shop->owner)
            ->putJson('/api/vehicles/' . $created->json('data.id'), ['model_id' => $premio->id])
            ->assertOk()
            ->assertJsonPath('data.model', 'Premio')
            ->assertJsonPath('data.variant_id', null)
            ->assertJsonPath('data.variant', null);
    }

    public function test_an_inactive_brand_cannot_be_chosen(): void
    {
        $this->brand->update(['is_active' => false]);

        $this->as($this->shop->owner)
            ->postJson('/api/vehicles', $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('brand_id');
    }

    /** A role like the owner might make for front-desk staff: view/edit vehicles, no create/delete. */
    private const STAFF = ['vendor-vehicles-list-view', 'vendor-vehicles-list-edit'];
    private const MANAGER = ['vendor-vehicles-list-view', 'vendor-vehicles-list-create', 'vendor-vehicles-list-edit', 'vendor-vehicles-list-delete'];

    public function test_staff_role_cannot_create_vehicles(): void
    {
        $staff = User::factory()->memberOf($this->shop, self::STAFF)->create();

        $this->as($staff)
            ->postJson('/api/vehicles', $this->payload())
            ->assertForbidden();
    }

    public function test_manager_role_can_create_vehicles(): void
    {
        $manager = User::factory()->memberOf($this->shop, self::MANAGER)->create();

        $this->as($manager)
            ->postJson('/api/vehicles', $this->payload())
            ->assertCreated();
    }

    public function test_staff_role_can_view_and_edit_but_not_archive_vehicles(): void
    {
        $vehicle = Vehicle::create($this->payload() + [
            'shop_id' => $this->shop->id, 'slug' => 'staff-view-car',
            'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $staff = User::factory()->memberOf($this->shop, self::STAFF)->create();

        $this->as($staff)
            ->getJson("/api/vehicles/{$vehicle->id}")
            ->assertOk();

        $this->as($staff)
            ->putJson("/api/vehicles/{$vehicle->id}/pricing", ['daily_rate' => 5000])
            ->assertOk();

        // archiving needs vendor-vehicles-list-delete, which this role doesn't have
        $this->as($staff)
            ->postJson("/api/vehicles/{$vehicle->id}/archive")
            ->assertForbidden();
    }

    public function test_a_suspended_account_loses_its_role_permissions(): void
    {
        $staff = User::factory()->suspended()->memberOf($this->shop, self::MANAGER)->create();

        $this->as($staff)
            ->postJson('/api/vehicles', $this->payload())
            ->assertForbidden();
    }
}
