<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A signed-in customer must not be able to request dates that another
 * booking already holds (BookingService::assertRequestIsValid()).
 */
class BookingOverlapTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $vehicle;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $shop = RentalShop::factory()->create(['status' => 'active', 'is_published' => true]);
        ShopSettings::createFor($shop->id); // booking numbers come from here
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 0, 'min_rental_days' => 1]);

        // Someone else's confirmed booking: days 10, 11, 12 (returned on day 13 at 10:00).
        $other = Customer::factory()->create();
        $booking = Booking::create([
            'booking_reference' => 'BKG-TAKEN-001', 'vehicle_id' => $this->vehicle->id, 'shop_id' => $shop->id,
            'customer_id' => $other->id,
            'pickup_at' => $this->at(10), 'return_at' => $this->at(13), 'rental_days' => 3,
            'status' => Booking::STATUS_CONFIRMED,
        ]);
        foreach ([10, 11, 12] as $day) {
            VehicleAvailability::create(['vehicle_id' => $this->vehicle->id, 'date' => $this->at($day)->toDateString(), 'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $booking->id]);
        }

        $this->customer = Customer::factory()->create();
    }

    private function at(int $day)
    {
        return now()->startOfDay()->addDays($day)->setTime(10, 0);
    }

    private function request(int $pickupDay, int $returnDay)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->customer->createToken('c')->plainTextToken)
            ->postJson('/api/bookings', [
                'vehicle_id' => $this->vehicle->id,
                'pickup_at' => $this->at($pickupDay)->toDateTimeString(),
                'return_at' => $this->at($returnDay)->toDateTimeString(),
                'payment_method' => 'cash',
            ]);
    }

    public function test_dates_inside_a_confirmed_booking_are_refused(): void
    {
        $this->request(11, 12)->assertUnprocessable()->assertJsonValidationErrors(['pickup_at' => 'already booked']);
        $this->assertSame(1, Booking::withoutGlobalScopes()->count());
    }

    public function test_a_range_that_spans_a_confirmed_booking_is_refused(): void
    {
        $this->request(8, 15)->assertUnprocessable()->assertJsonValidationErrors('pickup_at');
    }

    public function test_back_to_back_with_a_confirmed_booking_is_fine(): void
    {
        // Return at 10:00 on the day the other booking picks up, and pick up at 10:00 the day it's returned.
        $this->request(7, 10)->assertCreated();
        $this->request(13, 15)->assertCreated();
    }
}
