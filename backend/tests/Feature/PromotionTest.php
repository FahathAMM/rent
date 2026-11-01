<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\PlatformSetting;
use App\Models\Promotion;
use App\Models\PromotionPackage;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use App\Services\PromotionService;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Paid visibility: featured vehicles and city sponsorship — 10-monetization.md 2.2. */
class PromotionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;
    private VehicleCategory $car;
    private PromotionService $promotions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
        Storage::fake('local');

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id, 'city' => 'Kandy', 'district' => 'Kandy']);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole(User::SHOP_ROLE_OWNER);
        $this->car = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 2, 'is_active' => true]);
        $this->promotions = app(PromotionService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function as(User|SystemAdmin $who)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $who->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function vehicle(RentalShop $shop, ?VehicleCategory $category = null, int $rating = 0): Vehicle
    {
        $vehicle = Vehicle::withoutGlobalScopes()->create([
            'shop_id' => $shop->id, 'category_id' => ($category ?? $this->car)->id, 'title' => 'Car ' . Str::random(4),
            'slug' => 'car-' . Str::random(8), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(5), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $vehicle->forceFill(['rating_avg' => $rating])->save();
        VehiclePricing::create(['vehicle_id' => $vehicle->id, 'daily_rate' => 7000]);

        return $vehicle;
    }

    private function package(string $type, int $days): PromotionPackage
    {
        return PromotionPackage::where('type', $type)->where('days', $days)->firstOrFail();
    }

    private function grantFeatured(Vehicle $vehicle, int $days = 7): Promotion
    {
        return $this->promotions->grant(SystemAdmin::factory()->create(), $vehicle->shop()->withoutGlobalScopes()->first(), Promotion::TYPE_FEATURED, ['vehicle_id' => $vehicle->id], $days, null);
    }

    private function searchTitles(array $query = []): array
    {
        return collect($this->getJson('/api/public/vehicles?' . http_build_query($query))->assertOk()->json('data'))->pluck('title')->all();
    }

    public function test_a_vendor_buys_a_featured_listing_and_it_goes_live_on_approval(): void
    {
        $plain = $this->vehicle($this->shop, rating: 5);
        $boosted = $this->vehicle($this->shop, rating: 1);
        $pkg = $this->package('featured', 7);

        $this->as($this->owner)->post('/api/vendor/promotions/payments', [
            'package_id' => $pkg->id, 'vehicle_id' => $boosted->id, 'bank_reference' => 'TRX-9', 'proof' => UploadedFile::fake()->image('r.jpg'),
        ])->assertCreated()->assertJsonPath('data.state', 'pending')->assertJsonPath('data.amount', 1000);

        // Not featured until the platform approves.
        $this->assertSame([$plain->title, $boosted->title], $this->searchTitles());

        $promotion = Promotion::firstOrFail();
        $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/promotions/{$promotion->id}/approve")
            ->assertOk()->assertJsonPath('data.state', 'live');

        $this->assertSame([$boosted->title, $plain->title], $this->searchTitles());
        $this->getJson("/api/public/vehicles/{$boosted->slug}")->assertJsonPath('data.is_featured', true);
        // …in every sort, with the rest sorted normally underneath.
        $this->assertSame([$boosted->title, $plain->title], $this->searchTitles(['sort' => 'price_asc']));
        $this->assertSame([$boosted->title, $plain->title], $this->searchTitles(['sort' => 'newest']));

        // After 7 days it's over by itself.
        Carbon::setTestNow(now()->addDays(8));
        $this->assertSame([$plain->title, $boosted->title], $this->searchTitles());
    }

    public function test_when_slots_are_full_an_approval_is_scheduled_for_the_first_free_slot(): void
    {
        PlatformSetting::updateOrCreate(['key' => 'featured_listing_slots'], ['value' => ['value' => 1], 'group' => 'promotions']);
        $first = $this->grantFeatured($this->vehicle($this->shop), 7);
        $this->assertSame('live', $first->state());

        $other = RentalShop::factory()->create();
        $second = $this->grantFeatured($this->vehicle($other), 7);

        $this->assertSame('scheduled', $second->state());
        $this->assertEqualsWithDelta($first->ends_at->timestamp, $second->starts_at->timestamp, 2);

        // The vendor sees the same start date before paying.
        $third = $this->vehicle($this->shop);
        $this->as($this->owner)->getJson('/api/vendor/promotions/availability?' . http_build_query(['package_id' => $this->package('featured', 7)->id, 'vehicle_id' => $third->id]))
            ->assertOk()->assertJsonPath('data.starts_now', false);
    }

    public function test_the_same_vehicle_never_has_two_featurings_at_once(): void
    {
        $vehicle = $this->vehicle($this->shop);
        $first = $this->grantFeatured($vehicle, 7);
        $second = $this->grantFeatured($vehicle, 30);

        $this->assertEqualsWithDelta($first->ends_at->timestamp, $second->starts_at->timestamp, 2);
    }

    public function test_browse_shows_featured_first_but_sponsorship_does_not_change_the_order(): void
    {
        // Browse lists featured vehicles first; city sponsorship is not used there (for now).
        $rival = RentalShop::factory()->create(['city' => 'Kandy', 'district' => 'Kandy']);
        $rivalCar = $this->vehicle($rival, rating: 5);
        $myCar = $this->vehicle($this->shop, rating: 1);
        $this->promotions->grant(SystemAdmin::factory()->create(), $this->shop, Promotion::TYPE_SPONSORED, [], 7, null);

        $this->assertSame([$rivalCar->title, $myCar->title], $this->searchTitles(['city' => 'Kandy']));

        $this->grantFeatured($myCar);
        $this->assertSame([$myCar->title, $rivalCar->title], $this->searchTitles(['city' => 'Kandy']));
    }

    public function test_sponsoring_needs_the_shop_city(): void
    {
        $this->shop->update(['city' => null]);
        $this->vehicle($this->shop);

        $this->as($this->owner)->post('/api/vendor/promotions/payments', [
            'package_id' => $this->package('sponsored', 7)->id, 'proof' => UploadedFile::fake()->image('r.jpg'),
        ])->assertUnprocessable()->assertJsonValidationErrors('city');
    }

    public function test_the_platform_feature_buttons_grant_and_end_a_promotion(): void
    {
        $vehicle = $this->vehicle($this->shop);
        $admin = SystemAdmin::factory()->create();

        $this->as($admin)->postJson("/api/platform/listings/{$vehicle->id}/feature")->assertOk();
        $this->assertTrue($this->promotions->isFeatured($vehicle));

        $this->as($admin)->postJson("/api/platform/listings/{$vehicle->id}/unfeature")->assertOk();
        $this->assertFalse($this->promotions->isFeatured($vehicle));
    }

    public function test_promotions_are_owner_only(): void
    {
        $staff = User::factory()->create(['shop_id' => $this->shop->id]);
        $role = \App\Models\Role::create(['name' => 'Manager', 'guard_name' => 'web', 'shop_id' => $this->shop->id]);
        $role->syncPermissions(['vendor-dashboard-view']);
        $staff->setShopRole($role);

        $this->as($staff)->getJson('/api/vendor/promotions')->assertForbidden();
        $this->as($this->owner)->getJson('/api/vendor/promotions')->assertOk()->assertJsonCount(4, 'data.packages');
        $this->assertFalse(\App\Models\Role::isAssignableToShopRole('vendor-promotions-view'));
    }

    public function test_reading_is_featured_on_a_vehicle_never_breaks_saving_it(): void
    {
        $vehicle = $this->vehicle($this->shop);
        $this->grantFeatured($vehicle);

        $fresh = Vehicle::withoutGlobalScopes()->find($vehicle->id);
        $this->assertTrue($fresh->is_featured);
        $fresh->update(['title' => 'Renamed']); // would fail if is_featured were treated as a column
        $this->assertSame('Renamed', $fresh->fresh()->title);
    }
}
