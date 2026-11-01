<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Deleting a shop from the platform: Platform Owner only, refused while bookings are open, and the owner keeps their account but loses vendor access. */
class PlatformShopDeleteTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->owner = User::factory()->create();
        $token = $this->owner->createToken('test')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/onboarding/shops', [
                'name' => 'Galle Rides', 'email' => 'hello@gallerides.lk', 'phone' => '0771234567', 'whatsapp' => '0771234567',
                'address_line_1' => '12 Lighthouse Street', 'city' => 'Galle', 'district' => 'Galle',
            ])
            ->assertSuccessful();
        $this->app['auth']->forgetGuards();

        $this->owner->refresh();
        $this->shop = $this->owner->shop;
    }

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    public function test_platform_owner_deletes_a_shop_and_its_owner_loses_vendor_access(): void
    {
        $this->as(SystemAdmin::factory()->owner()->create())
            ->deleteJson("/api/platform/shops/{$this->shop->id}", ['reason' => 'Duplicate registration'])
            ->assertOk();

        $this->assertSoftDeleted('rental_shops', ['id' => $this->shop->id]);

        $owner = $this->owner->fresh();
        $this->assertNull($owner->shop_id);
        $this->assertFalse($owner->roles()->whereNotNull('shop_id')->exists(), 'shop roles are removed');

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $owner->createToken('t2')->plainTextToken)
            ->getJson('/api/vehicles')
            ->assertForbidden();
    }

    public function test_a_regular_platform_admin_cannot_delete_a_shop(): void
    {
        $this->as(SystemAdmin::factory()->create())
            ->deleteJson("/api/platform/shops/{$this->shop->id}", ['reason' => 'Nope'])
            ->assertForbidden();

        $this->assertNotSoftDeleted('rental_shops', ['id' => $this->shop->id]);
    }

    public function test_a_reason_is_required(): void
    {
        $this->as(SystemAdmin::factory()->owner()->create())
            ->deleteJson("/api/platform/shops/{$this->shop->id}")
            ->assertUnprocessable();
    }

    public function test_a_shop_with_an_open_booking_cannot_be_deleted(): void
    {
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $this->shop->id, 'category_id' => $category->id, 'title' => 'Aqua',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_DRAFT,
        ]);
        Booking::create([
            'booking_reference' => 'BKG-DEL-001', 'vehicle_id' => $vehicle->id, 'shop_id' => $this->shop->id,
            'customer_id' => Customer::factory()->create()->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3,
            'status' => Booking::STATUS_CONFIRMED,
        ]);

        $this->as(SystemAdmin::factory()->owner()->create())
            ->deleteJson("/api/platform/shops/{$this->shop->id}", ['reason' => 'Fraud'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('shop');

        $this->assertNotSoftDeleted('rental_shops', ['id' => $this->shop->id]);
        $this->assertSame($this->shop->id, (int) $this->owner->fresh()->shop_id);
    }
}
