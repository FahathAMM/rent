<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The platform dashboard: who is on the platform, what shops paid the platform, and the review queues — nothing about a shop's own bookings. */
class PlatformDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_shows_platform_income_and_counts_not_shop_business(): void
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id, 'name' => 'Lanka Rides', 'verification_status' => 'verified']);
        $owner->update(['shop_id' => $shop->id]);
        User::factory()->create(['shop_id' => $shop->id]); // a staff member
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = fn (string $status) => Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => $status, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $published = $vehicle(Vehicle::STATUS_PUBLISHED);
        $vehicle('draft');
        $customer = Customer::factory()->create(['name' => 'Nimal']);

        // A shop's own booking: must not show up as platform money.
        $booking = Booking::create([
            'booking_reference' => 'BKG-1', 'vehicle_id' => $published->id, 'shop_id' => $shop->id, 'customer_id' => $customer->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3, 'status' => Booking::STATUS_CONFIRMED,
        ]);
        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => [], 'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => 20000, 'subtotal' => 20000, 'total_payable' => 20000, 'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'BKG-1'),
        ]);
        Review::create([
            'booking_id' => $booking->id, 'vehicle_id' => $published->id, 'shop_id' => $shop->id,
            'user_id' => $customer->id, 'rating' => 5, 'status' => Review::STATUS_PENDING,
        ]);

        $planId = SubscriptionPlan::where('code', 'pro')->value('id');
        $payment = fn (string $status, float $amount, $reviewedAt = null) => SubscriptionPayment::create([
            'reference_no' => 'SUB-' . Str::upper(Str::random(8)), 'shop_id' => $shop->id, 'plan_id' => $planId,
            'periods' => 1, 'amount' => $amount, 'status' => $status, 'reviewed_at' => $reviewedAt,
        ]);
        $payment(SubscriptionPayment::STATUS_APPROVED, 2500, now());
        $payment(SubscriptionPayment::STATUS_APPROVED, 2500, now()->subDays(45)); // all time, but before the 30-day window
        $payment(SubscriptionPayment::STATUS_PENDING, 6000);
        Promotion::create([
            'reference_no' => 'PRM-1', 'shop_id' => $shop->id, 'type' => Promotion::TYPE_SPONSORED, 'city' => 'Kandy', 'days' => 7,
            'amount' => 8000, 'kind' => Promotion::KIND_PAID, 'status' => Promotion::STATUS_APPROVED, 'reviewed_at' => now(),
        ]);

        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;
        $res = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/platform/dashboard')->assertOk();

        $res->assertJsonMissingPath('data.gmv')->assertJsonMissingPath('data.bookings')
            ->assertJsonMissingPath('data.sales')->assertJsonMissingPath('data.recent_bookings');

        $this->assertEquals(13000, $res->json('data.income.total'));
        $this->assertEquals(5000, $res->json('data.income.subscriptions.amount'));
        $this->assertSame(2, $res->json('data.income.subscriptions.count'));
        $this->assertEquals(8000, $res->json('data.income.promotions.amount'));
        $this->assertSame(1, $res->json('data.income.paying_shops'));
        $this->assertSame(1, $res->json('data.income.pending.count'));
        $this->assertEquals(6000, $res->json('data.income.pending.amount'));

        $res->assertJsonPath('data.community.vendors', 2)
            ->assertJsonPath('data.community.shop_owners', 1)
            ->assertJsonPath('data.community.shop_staff', 1)
            ->assertJsonPath('data.community.shops', 1)
            ->assertJsonPath('data.community.verified_shops', 1)
            ->assertJsonPath('data.community.vehicles', 2)
            ->assertJsonPath('data.community.published_vehicles', 1)
            ->assertJsonPath('data.community.customers', 1)
            ->assertJsonPath('data.queues.reviews', 1)
            ->assertJsonPath('data.queues.subscription_payments', 1)
            ->assertJsonCount(30, 'data.trend.days')
            ->assertJsonPath('data.trend.current.shops', 1)
            ->assertJsonPath('data.trend.current.vehicles', 2)
            ->assertJsonPath('data.top_shops.0.name', 'Lanka Rides')
            ->assertJsonCount(12, 'data.income_months')
            ->assertJsonPath('data.vehicles_by_category.0.name', 'Car')
            ->assertJsonPath('data.vehicles_by_category.0.vehicles', 2);

        $thisMonth = collect($res->json('data.income_months'))->last();
        $this->assertSame(now()->format('Y-m'), $thisMonth['month']);
        $this->assertEquals(8000, $thisMonth['promotions']);
        $this->assertEquals(5000, collect($res->json('data.income_months'))->sum('subscriptions'));

        $this->assertEquals(10500, $res->json('data.trend.current.income'));  // the 45-day-old payment is in the 30 days before
        $this->assertEquals(2500, $res->json('data.trend.previous.income'));
        $this->assertEquals(13000, $res->json('data.top_shops.0.amount'));

        $today = collect($res->json('data.trend.days'))->last();
        $this->assertSame(now()->toDateString(), $today['date']);
        $this->assertEquals(10500, $today['income']);
        $this->assertSame(1, $today['shops']);
    }
}
