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

/** Platform listing moderation: the list shows every state unless filtered, and the detail page payload carries shop, counts and named history. */
class PlatformListingDetailTest extends TestCase
{
    use RefreshDatabase;

    private SystemAdmin $admin;
    private Vehicle $pending;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);

        foreach ([Vehicle::MODERATION_PENDING, Vehicle::MODERATION_APPROVED] as $i => $moderation) {
            $vehicle = Vehicle::create([
                'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => "Car {$i}",
                'slug' => "car-{$i}-" . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
                'registration_number' => 'CAR-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
                'seating_capacity' => 5, 'status' => Vehicle::STATUS_DRAFT, 'moderation_status' => $moderation,
            ]);
            $this->pending ??= $vehicle;
        }

        $this->admin = SystemAdmin::factory()->create(['name' => 'Asha Admin']);
    }

    private function as()
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $this->admin->createToken('t')->plainTextToken);
    }

    public function test_a_platform_unpublish_sticks_until_the_platform_republishes(): void
    {
        $owner = User::find($this->pending->shop->owner_user_id);
        $owner->update(['shop_id' => $this->pending->shop_id]);
        $owner->setShopRole(User::SHOP_ROLE_OWNER);
        $this->pending->update(['status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED]);

        $this->as()->postJson("/api/platform/listings/{$this->pending->id}/unpublish", ['reason' => 'Fake photos'])->assertOk();
        $this->pending->refresh();
        $this->assertSame(Vehicle::STATUS_UNPUBLISHED, $this->pending->status);
        $this->assertSame(Vehicle::MODERATION_FLAGGED, $this->pending->moderation_status);

        // The shop can't put it straight back up.
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $owner->createToken('v')->plainTextToken)
            ->postJson("/api/vehicles/{$this->pending->id}/publish")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'This listing was taken offline by the platform: Fake photos. Please contact the platform admin to have it republished.']);

        $this->as()->postJson("/api/platform/listings/{$this->pending->id}/republish")->assertOk();
        $this->pending->refresh();
        $this->assertSame(Vehicle::STATUS_PUBLISHED, $this->pending->status);
        $this->assertSame(Vehicle::MODERATION_APPROVED, $this->pending->moderation_status);
        $this->assertNull($this->pending->moderation_note);
    }

    public function test_only_an_unpublished_listing_can_be_republished(): void
    {
        $this->as()->postJson("/api/platform/listings/{$this->pending->id}/republish")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_the_list_shows_every_moderation_state_by_default(): void
    {
        $this->as()->getJson('/api/platform/listings')->assertOk()->assertJsonPath('record.total', 2);
        $this->as()->getJson('/api/platform/listings?moderation_status=pending')->assertOk()->assertJsonPath('record.total', 1);
    }

    public function test_the_detail_payload_has_shop_counts_and_named_history(): void
    {
        $this->as()->postJson("/api/platform/listings/{$this->pending->id}/reject", ['reason' => 'Blurry photos'])->assertOk();

        $this->as()->getJson("/api/platform/listings/{$this->pending->id}")
            ->assertOk()
            ->assertJsonPath('data.shop.id', $this->pending->shop_id)
            ->assertJsonPath('data.bookings_count', 0)
            ->assertJsonPath('data.moderation_history.0.reason', 'Blurry photos')
            ->assertJsonPath('data.moderation_history.0.actor_name', 'Asha Admin');
    }
}
