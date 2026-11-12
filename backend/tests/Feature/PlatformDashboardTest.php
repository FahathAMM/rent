<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The platform dashboard: totals, 30-day trend, review queues, top shops and recent bookings. */
class PlatformDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_has_trend_queues_top_shops_and_recent_bookings(): void
    {
        $shop = RentalShop::factory()->create(['owner_user_id' => User::factory()->create()->id, 'name' => 'Lanka Rides']);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $customer = Customer::factory()->create(['name' => 'Nimal']);

        foreach ([['BKG-1', Booking::STATUS_CONFIRMED, 20000], ['BKG-2', Booking::STATUS_PENDING, 5000]] as [$ref, $status, $amount]) {
            $booking = Booking::create([
                'booking_reference' => $ref, 'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id, 'customer_id' => $customer->id,
                'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3, 'status' => $status,
            ]);
            BookingPricing::create([
                'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => [], 'rate_plan' => 'daily', 'rate_breakdown' => [],
                'base_amount' => $amount, 'subtotal' => $amount, 'total_payable' => $amount,
                'computed_at' => now(), 'snapshot_hash' => hash('sha256', $ref),
            ]);
        }

        Review::create([
            'booking_id' => Booking::first()->id, 'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id,
            'user_id' => $customer->id, 'rating' => 5, 'status' => Review::STATUS_PENDING,
        ]);

        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;
        $res = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/platform/dashboard')->assertOk();

        $res->assertJsonCount(30, 'data.trend.days')
            ->assertJsonPath('data.trend.current.bookings', 2)
            ->assertJsonPath('data.trend.current.value', 20000) // only the confirmed booking counts as booked value
            ->assertJsonPath('data.trend.previous.bookings', 0)
            ->assertJsonPath('data.queues.reviews', 1)
            ->assertJsonPath('data.community.customers', 1)
            ->assertJsonPath('data.community.published_vehicles', 1)
            ->assertJsonPath('data.top_shops.0.name', 'Lanka Rides')
            ->assertJsonPath('data.top_shops.0.bookings', 2)
            ->assertJsonCount(2, 'data.recent_bookings');

        $today = collect($res->json('data.trend.days'))->last();
        $this->assertSame(now()->toDateString(), $today['date']);
        $this->assertSame(2, $today['bookings']);
    }
}
