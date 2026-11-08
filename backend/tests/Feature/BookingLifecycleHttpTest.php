<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SecurityDeposit;
use App\Models\ShopSettings;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The whole rental cycle driven through the HTTP API the way the three apps use it:
 * customer books -> shop accepts -> handover -> return -> customer reviews -> shop replies,
 * with the platform and the shop's dashboards seeing the result. Plus the side exits
 * (reject, customer cancel, platform cancel).
 */
class BookingLifecycleHttpTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Customer $customer;
    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $shop->id]);
        $this->owner->setShopRole('owner');
        $shop->update(['status' => 'active', 'is_published' => true]);
        ShopSettings::createFor($shop->id); // booking numbers come from here

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 0, 'min_rental_days' => 1, 'security_deposit' => 5000, 'deposit_method' => 'cash_on_pickup']);

        $this->customer = Customer::factory()->create();
    }

    /** A fresh request as someone else: forget the guard's cached user (as ShopRolesTest does). */
    private function fresh()
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }

    /** Test-side lookups ignore whichever shop context the last vendor request left behind. */
    private function bookingRow(string $ref): Booking
    {
        return Booking::withoutGlobalScopes()->where('booking_reference', $ref)->firstOrFail();
    }

    private function asCustomer()
    {
        return $this->fresh()->withToken($this->customer->createToken('c')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function asVendor()
    {
        return $this->fresh()->withToken($this->owner->createToken('v')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function asPlatform()
    {
        return $this->fresh()->withToken(SystemAdmin::factory()->create()->createToken('p')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    /** Customer requests a 3-day cash rental starting in 2 days; returns the booking reference. */
    private function book(int $startInDays = 2): string
    {
        $pickup = now()->addDays($startInDays)->setTime(10, 0);

        $response = $this->asCustomer()->postJson('/api/bookings', [
            'vehicle_id' => $this->vehicle->id,
            'pickup_at' => $pickup->toDateTimeString(),
            'return_at' => $pickup->copy()->addDays(3)->toDateTimeString(),
            'payment_method' => 'cash',
            'customer_note' => 'Arriving by train',
        ])->assertCreated();

        $reference = $response->json('data.booking_reference');
        $this->assertNotEmpty($reference);
        $this->assertSame(Booking::STATUS_PENDING, $this->bookingRow($reference)->status);

        return $reference;
    }

    public function test_full_cycle_from_booking_to_return_and_review(): void
    {
        $ref = $this->book();
        $booking = fn () => $this->bookingRow($ref);

        // The shop sees the request and accepts it: confirmed, dates blocked.
        $this->asVendor()->getJson('/api/vendor/bookings')->assertOk()->assertJsonFragment(['booking_reference' => $ref]);
        $this->asVendor()->getJson("/api/vendor/bookings/{$ref}")->assertOk();
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/accept")->assertOk();
        $this->assertSame(Booking::STATUS_CONFIRMED, $booking()->status);
        $this->assertSame(3, VehicleAvailability::where('booking_id', $booking()->id)->count());

        // The customer sees it confirmed, with a voucher.
        $this->asCustomer()->getJson("/api/bookings/{$ref}")->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->asCustomer()->get("/api/bookings/{$ref}/voucher")->assertOk();

        // Pickup day: handover needs the cash confirmed.
        $this->travelTo($booking()->pickup_at->copy()->subMinutes(30));
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/handover", ['odometer_reading' => 42000, 'fuel_level' => 'full'])
            ->assertUnprocessable()->assertJsonValidationErrors('cash_received');
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/handover", [
            'odometer_reading' => 42000, 'fuel_level' => 'full', 'customer_present' => true, 'cash_received' => true,
        ])->assertOk();
        $this->assertSame(Booking::STATUS_ACTIVE, $booking()->status);
        $this->assertSame(Booking::PAYMENT_PAID, $booking()->payment_status);

        // A review is refused while the rental is still running.
        $this->asCustomer()->postJson('/api/reviews', ['booking_reference' => $ref, 'rating' => 5])->assertStatus(422);

        // Return day: completed, deposit settled, nothing owed.
        $this->travelTo($booking()->return_at->copy()->subMinutes(15));
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/return", [
            'odometer_reading' => 42450, 'fuel_level' => 'three_quarter', 'notes' => 'Clean, no damage',
        ])->assertOk();
        $done = $booking();
        $this->assertSame(Booking::STATUS_COMPLETED, $done->status);
        $this->assertEquals(0, $done->balanceDue());
        $this->assertSame(SecurityDeposit::STATUS_RELEASED, $done->securityDeposit->status);
        $this->assertEquals(5000, $done->securityDeposit->amount_collected);
        $this->assertSame(
            ['confirmed', 'active', 'completed'],
            $done->statusHistories()->where('field', 'status')->where('from_value', '!=', null)->orderBy('id')->pluck('to_value')->all(),
        );

        // The customer reviews; the shop sees and replies to it.
        $this->asCustomer()->postJson('/api/reviews', ['booking_reference' => $ref, 'rating' => 5, 'comment' => 'Great car'])->assertCreated();
        $this->asCustomer()->postJson('/api/reviews', ['booking_reference' => $ref, 'rating' => 4])->assertStatus(422);
        // Reviews are moderated: the shop sees it once the platform publishes it.
        $reviewId = Review::where('booking_id', $done->id)->value('id');
        $this->assertSame(Review::STATUS_PENDING, Review::find($reviewId)->status);
        $this->asVendor()->getJson('/api/vendor/reviews')->assertOk()->assertJsonMissing(['id' => $reviewId]);
        $this->asPlatform()->postJson("/api/platform/reviews/{$reviewId}/publish")->assertSuccessful();
        $this->asVendor()->getJson('/api/vendor/reviews')->assertOk()->assertJsonFragment(['id' => $reviewId]);
        $this->asVendor()->postJson("/api/vendor/reviews/{$reviewId}/reply", ['reply' => 'Thank you!'])->assertSuccessful();
        $this->assertSame('Thank you!', Review::find($reviewId)->owner_reply);

        // Everyone's overview pages load with the finished booking.
        $this->asCustomer()->getJson('/api/bookings')->assertOk()->assertJsonFragment(['booking_reference' => $ref]);
        $this->asVendor()->getJson('/api/dashboard')->assertOk();
        $this->asVendor()->getJson('/api/vendor/earnings')->assertOk();
        $this->asVendor()->getJson('/api/vendor/earnings/bookings')->assertOk();
        $platform = $this->asPlatform();
        $platform->getJson('/api/platform/bookings')->assertOk()->assertJsonFragment(['booking_reference' => $ref]);
        $platform->getJson("/api/platform/bookings/{$ref}")->assertOk()->assertJsonPath('data.balance_due', 0);
        $platform->getJson('/api/platform/dashboard')->assertOk();
    }

    public function test_shop_can_reject_a_request_and_the_dates_stay_free(): void
    {
        $ref = $this->book();

        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/reject", ['reason' => 'Vehicle in service'])->assertOk();

        $booking = $this->bookingRow($ref);
        $this->assertSame(Booking::STATUS_REJECTED, $booking->status);
        $this->assertSame(0, VehicleAvailability::where('booking_id', $booking->id)->count());
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/accept")->assertUnprocessable();
    }

    public function test_customer_can_cancel_a_confirmed_unpaid_booking_and_rebook_the_dates(): void
    {
        $ref = $this->book();
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/accept")->assertOk();

        $this->asCustomer()->postJson("/api/bookings/{$ref}/cancel", ['reason' => 'Plans changed'])->assertOk();

        $this->assertSame(Booking::STATUS_CANCELLED_BY_CUSTOMER, $this->bookingRow($ref)->status);
        $this->book(); // the same dates can be requested again
    }

    public function test_platform_can_cancel_a_confirmed_booking(): void
    {
        $ref = $this->book();
        $this->asVendor()->postJson("/api/vendor/bookings/{$ref}/accept")->assertOk();

        $this->asPlatform()->postJson("/api/platform/bookings/{$ref}/cancel", ['reason' => 'Fraud check'])->assertOk();

        $this->assertSame(Booking::STATUS_CANCELLED_BY_ADMIN, $this->bookingRow($ref)->status);
    }

    public function test_a_shop_cannot_act_on_another_shops_booking(): void
    {
        $ref = $this->book();
        $other = User::factory()->create();
        $otherShop = RentalShop::factory()->create(['owner_user_id' => $other->id]);
        $other->update(['shop_id' => $otherShop->id]);
        $other->setShopRole('owner');

        $this->fresh()->withToken($other->createToken('o')->plainTextToken)->withHeader('Accept', 'application/json')
            ->postJson("/api/vendor/bookings/{$ref}/accept")->assertNotFound();
        $this->assertSame(Booking::STATUS_PENDING, $this->bookingRow($ref)->status);
    }
}
