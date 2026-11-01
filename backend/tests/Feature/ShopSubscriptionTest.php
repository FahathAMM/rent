<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\ShopSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Services\ShopOnboardingService;
use App\Services\SubscriptionService;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/** Shop plans: trial, unpaid lock, feature gates, limits, paying, approval, renewal and grace — 10-monetization.md. */
class ShopSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;
    private SubscriptionService $subscriptions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
        Storage::fake('local');

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->withoutPlan()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole(User::SHOP_ROLE_OWNER);
        $this->subscriptions = app(SubscriptionService::class);
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

    private function plan(string $code): SubscriptionPlan
    {
        return SubscriptionPlan::where('code', $code)->firstOrFail();
    }

    private function vehicle(string $status = Vehicle::STATUS_PUBLISHED): Vehicle
    {
        $category = VehicleCategory::firstOrCreate(['slug' => 'car'], ['name' => 'Car', 'sort_order' => 1, 'is_active' => true]);

        return Vehicle::withoutGlobalScopes()->create([
            'shop_id' => $this->shop->id, 'category_id' => $category->id, 'title' => 'Car ' . Str::random(4),
            'slug' => 'car-' . Str::random(8), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(5), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => $status, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    public function test_a_shop_without_a_plan_is_locked_except_for_paying(): void
    {
        $this->as($this->owner)->getJson('/api/vendor/subscription/summary')
            ->assertOk()
            ->assertJsonPath('data.state', 'unpaid')
            ->assertJsonPath('data.locked', true)
            ->assertJsonPath('data.features', []);

        foreach (['/api/dashboard', '/api/vehicles', '/api/vendor/bookings', '/api/vendor/shop-profile'] as $url) {
            $this->as($this->owner)->getJson($url)->assertForbidden()->assertJsonPath('code', 'subscription_required');
        }
        $this->as($this->owner)->getJson('/api/vendor/subscription')->assertOk();

        $this->subscriptions->grant($this->shop->id, $this->plan('basic'), 30, ShopSubscription::KIND_GRANTED, null, null);
        $this->as($this->owner)->getJson('/api/vehicles')->assertOk();
    }

    public function test_verifying_a_shop_starts_the_pro_trial_once(): void
    {
        $shop = RentalShop::factory()->withoutPlan()->create(['verification_status' => 'pending', 'owner_user_id' => User::factory()->create()->id]);
        $admin = SystemAdmin::factory()->create();

        app(ShopOnboardingService::class)->verify($admin, $shop);
        app(ShopOnboardingService::class)->verify($admin, $shop->fresh());

        $current = $this->subscriptions->current($shop->id);
        $this->assertSame('trial', $current['state']);
        $this->assertSame('pro', $current['plan']->code);
        $this->assertSame(1, ShopSubscription::where('shop_id', $shop->id)->count());
    }

    public function test_plan_features_gate_the_routes(): void
    {
        // Basic has none of the extra features.
        $this->subscriptions->grant($this->shop->id, $this->plan('basic'), 30, ShopSubscription::KIND_GRANTED, null, null);

        $this->as($this->owner)->getJson('/api/expenses')->assertForbidden()->assertJsonPath('code', 'plan_feature')->assertJsonPath('feature', 'expenses');
        $this->as($this->owner)->getJson('/api/vehicles-availability')->assertForbidden()->assertJsonPath('code', 'plan_feature');
        $this->as($this->owner)->getJson('/api/vendor/staff')->assertForbidden()->assertJsonPath('code', 'plan_feature');

        $this->subscriptions->grant($this->shop->id, $this->plan('pro'), 30, ShopSubscription::KIND_GRANTED, null, null);

        $this->as($this->owner)->getJson('/api/expenses')->assertOk();
        $this->as($this->owner)->getJson('/api/vendor/staff')->assertOk();
    }

    public function test_basic_limits_block_adding_and_publishing_but_keep_existing_listings(): void
    {
        $this->subscriptions->grant($this->shop->id, $this->plan('basic'), 30, ShopSubscription::KIND_GRANTED, null, null);

        // Basic allows 2 vehicles. Three published ones (left over from a trial) stay published.
        $this->vehicle(); $this->vehicle(); $this->vehicle();
        $draft = $this->vehicle(Vehicle::STATUS_DRAFT);

        $this->assertSame(3, Vehicle::withoutGlobalScopes()->where('shop_id', $this->shop->id)->where('status', Vehicle::STATUS_PUBLISHED)->count());

        try {
            $this->subscriptions->ensureCanAddVehicle($this->shop->id);
            $this->fail('Adding a 5th vehicle on Basic should be refused.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
            $this->assertStringContainsString('Basic plan allows 2 vehicles', $e->getMessage());
        }

        $this->as($this->owner)->postJson("/api/vehicles/{$draft->id}/publish")->assertForbidden();
        $this->assertSame(Vehicle::STATUS_DRAFT, $draft->fresh()->status);

        // On Pro (10 vehicles) both are fine.
        $this->subscriptions->grant($this->shop->id, $this->plan('pro'), 30, ShopSubscription::KIND_GRANTED, null, null);
        $this->subscriptions->ensureCanAddVehicle($this->shop->id);
        $this->subscriptions->ensureCanPublish($draft);
        $this->assertTrue(true);
    }

    public function test_paying_and_approval_starts_the_plan_and_renewing_extends_it(): void
    {
        $pro = $this->plan('pro');

        $this->as($this->owner)->post('/api/vendor/subscription/payments', [
            'plan_id' => $pro->id, 'periods' => 3, 'bank_reference' => 'TRX-1',
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertCreated()->assertJsonPath('data.amount', 7500)->assertJsonPath('data.status', 'pending');

        // Only one payment can wait for review at a time.
        $this->as($this->owner)->post('/api/vendor/subscription/payments', [
            'plan_id' => $pro->id, 'periods' => 1, 'proof' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertUnprocessable();

        $payment = SubscriptionPayment::firstOrFail();
        $this->assertNotNull($payment->proof);
        $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/subscription-payments/{$payment->id}/approve")->assertOk();

        $current = $this->subscriptions->current($this->shop->id);
        $this->assertSame('active', $current['state']);
        $this->assertSame('pro', $current['plan']->code);
        $this->assertEqualsWithDelta(now()->addDays(90)->timestamp, $current['ends_at']->timestamp, 5);

        // Renewing the same plan carries on from the current end date.
        $this->subscriptions->grant($this->shop->id, $pro, 30, ShopSubscription::KIND_PAID, null, null);
        $this->assertEqualsWithDelta(now()->addDays(120)->timestamp, $this->subscriptions->current($this->shop->id)['ends_at']->timestamp, 5);

        // The platform header counts it.
        $this->as(SystemAdmin::factory()->create())->getJson('/api/platform/subscription-stats')
            ->assertOk()->assertJsonPath('data.this_month.amount', 7500)->assertJsonPath('data.shops.active', 1)->assertJsonPath('data.pending.count', 0);

        // Approving twice is refused.
        $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/subscription-payments/{$payment->id}/approve")->assertUnprocessable();
    }

    public function test_a_rejected_payment_lets_the_shop_pay_again(): void
    {
        $pro = $this->plan('pro');
        $this->as($this->owner)->post('/api/vendor/subscription/payments', ['plan_id' => $pro->id, 'periods' => 1, 'proof' => UploadedFile::fake()->image('r.jpg')])->assertCreated();
        $payment = SubscriptionPayment::firstOrFail();

        $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/subscription-payments/{$payment->id}/reject", ['reason' => 'Amount not received'])->assertOk();

        $this->assertSame('rejected', $payment->fresh()->status);
        $this->assertSame('unpaid', $this->subscriptions->current($this->shop->id)['state']);
        $this->as($this->owner)->post('/api/vendor/subscription/payments', ['plan_id' => $pro->id, 'periods' => 1, 'proof' => UploadedFile::fake()->image('r.jpg')])->assertCreated();
    }

    public function test_a_paid_plan_gets_grace_then_locks_but_a_trial_locks_straight_away(): void
    {
        $this->subscriptions->grant($this->shop->id, $this->plan('pro'), 30, ShopSubscription::KIND_PAID, null, null);

        Carbon::setTestNow(now()->addDays(32)); // ended 2 days ago, grace is 7
        $current = $this->subscriptions->current($this->shop->id);
        $this->assertSame('grace', $current['state']);
        $this->assertSame('pro', $current['plan']->code);

        $this->as($this->owner)->getJson('/api/vehicles')->assertOk(); // still open during grace

        Carbon::setTestNow(now()->addDays(6)); // 8 days after the end
        $this->assertSame('unpaid', $this->subscriptions->current($this->shop->id)['state']);
        $this->assertTrue($this->subscriptions->isLocked($this->shop->id));

        $other = RentalShop::factory()->withoutPlan()->create(['owner_user_id' => User::factory()->create()->id]);
        ShopSubscription::create(['shop_id' => $other->id, 'plan_id' => $this->plan('pro')->id, 'kind' => ShopSubscription::KIND_TRIAL, 'starts_at' => now()->subDays(31), 'ends_at' => now()->subDay()]);
        $this->assertSame('unpaid', $this->subscriptions->current($other->id)['state']);
    }

    public function test_the_subscription_page_is_owner_only_but_the_summary_is_not(): void
    {
        $this->subscriptions->grant($this->shop->id, $this->plan('pro'), 30, ShopSubscription::KIND_GRANTED, null, null);
        $staff = User::factory()->create(['shop_id' => $this->shop->id]);
        $role = \App\Models\Role::create(['name' => 'Manager', 'guard_name' => 'web', 'shop_id' => $this->shop->id]);
        $role->syncPermissions(['vendor-dashboard-view']);
        $staff->setShopRole($role);

        $this->as($staff)->getJson('/api/vendor/subscription/summary')->assertOk()->assertJsonPath('data.plan.code', 'pro');
        $this->as($staff)->getJson('/api/vendor/subscription')->assertForbidden();
        $this->as($this->owner)->getJson('/api/vendor/subscription')->assertOk()->assertJsonCount(3, 'data.plans');
        $this->assertFalse(\App\Models\Role::isAssignableToShopRole('vendor-subscription-view'));
    }

    public function test_basic_is_a_paid_plan_and_only_the_platform_owner_edits_plans(): void
    {
        $basic = $this->plan('basic');
        $this->assertEquals(500, $basic->price);
        $this->assertSame(2, $basic->max_vehicles);

        $payload = ['code' => 'basic', 'name' => 'Starter', 'price' => 750, 'period_days' => 30, 'max_vehicles' => 3, 'features' => [], 'is_active' => true];
        $this->as(SystemAdmin::factory()->create())->putJson("/api/platform/subscription-plans/{$basic->id}", $payload)->assertForbidden();
        $this->as(SystemAdmin::factory()->owner()->create())->putJson("/api/platform/subscription-plans/{$basic->id}", $payload)->assertOk();

        $basic->refresh();
        $this->assertSame('Starter', $basic->name);
        $this->assertEquals(750, $basic->price);
        $this->assertSame(3, $basic->max_vehicles);

        // Basic can be paid for like any plan.
        $this->as($this->owner)->post('/api/vendor/subscription/payments', ['plan_id' => $basic->id, 'periods' => 2, 'proof' => UploadedFile::fake()->image('r.jpg')])
            ->assertCreated()->assertJsonPath('data.amount', 1500);
    }

    private function endOfDay(int $daysFromToday): Carbon
    {
        return now(config('app.display_timezone'))->addDays($daysFromToday)->endOfDay()->utc();
    }

    private function grantUntil(int $planId, int $daysFromToday)
    {
        return $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/shops/{$this->shop->id}/subscription", [
            'plan_id' => $planId,
            'ends_at' => now(config('app.display_timezone'))->addDays($daysFromToday)->toDateString(),
            'note' => 'Test',
        ]);
    }

    public function test_the_platform_extends_a_trial_and_it_stays_a_trial(): void
    {
        $pro = $this->plan('pro');
        ShopSubscription::create(['shop_id' => $this->shop->id, 'plan_id' => $pro->id, 'kind' => ShopSubscription::KIND_TRIAL, 'starts_at' => now()->subDays(20), 'ends_at' => now()->addDays(10)]);

        $this->grantUntil($pro->id, 25)->assertOk()->assertJsonPath('data.current.state', 'trial');

        $current = $this->subscriptions->current($this->shop->id);
        $this->assertSame('trial', $current['state']);
        $this->assertEqualsWithDelta($this->endOfDay(25)->timestamp, $current['ends_at']->timestamp, 2);
    }

    public function test_the_platform_shortens_the_running_plan(): void
    {
        $pro = $this->plan('pro');
        $this->subscriptions->grant($this->shop->id, $pro, 30, ShopSubscription::KIND_PAID, null, null);
        $this->subscriptions->grant($this->shop->id, $pro, 30, ShopSubscription::KIND_PAID, null, null); // queued renewal → 60 days

        $this->grantUntil($pro->id, 5)->assertOk()->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Plan shortened by'));

        $current = $this->subscriptions->current($this->shop->id);
        $this->assertSame('active', $current['state']);
        $this->assertEqualsWithDelta($this->endOfDay(5)->timestamp, $current['ends_at']->timestamp, 2);
        $this->assertSame(1, ShopSubscription::where('shop_id', $this->shop->id)->count(), 'the queued renewal is dropped');
    }

    public function test_granting_a_different_plan_starts_it_now_until_the_date(): void
    {
        $this->subscriptions->grant($this->shop->id, $this->plan('pro'), 30, ShopSubscription::KIND_PAID, null, null);

        $this->grantUntil($this->plan('business')->id, 12)->assertOk()->assertJsonPath('data.current.plan.code', 'business');

        $current = $this->subscriptions->current($this->shop->id);
        $this->assertSame('business', $current['plan']->code);
        $this->assertEqualsWithDelta($this->endOfDay(12)->timestamp, $current['ends_at']->timestamp, 2);
    }

    public function test_an_end_date_in_the_past_is_refused(): void
    {
        $this->grantUntil($this->plan('pro')->id, -1)->assertUnprocessable()->assertJsonValidationErrors('ends_at');
    }

    public function test_the_platform_can_give_a_locked_shop_a_real_trial(): void
    {
        $this->assertTrue($this->subscriptions->isLocked($this->shop->id));

        $this->as(SystemAdmin::factory()->create())->postJson("/api/platform/shops/{$this->shop->id}/subscription", [
            'plan_id' => $this->plan('pro')->id,
            'ends_at' => now(config('app.display_timezone'))->addDays(14)->toDateString(),
            'trial' => true,
        ])->assertOk()->assertJsonPath('message', 'Free trial started')->assertJsonPath('data.current.state', 'trial');

        // A trial gets no grace: the day after it ends the shop is locked again.
        Carbon::setTestNow(now()->addDays(16));
        $this->assertTrue($this->subscriptions->isLocked($this->shop->id));
    }
}
