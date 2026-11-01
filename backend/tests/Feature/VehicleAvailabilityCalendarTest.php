<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The vendor availability calendar keys every cell on a plain Y-m-d day -
 * an ISO timestamp ("...T00:00:00.000000Z") matched nothing and showed
 * every day as available.
 */
class VehicleAvailabilityCalendarTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class); // vendor permissions

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $shop->id]);
        $this->owner->setShopRole('owner');

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function asOwner()
    {
        // Real bearer token, not actingAs() - see ShopBoundaryTest's docblock.
        return $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('test')->plainTextToken);
    }

    public function test_days_come_back_as_plain_dates_with_their_booking(): void
    {
        $customer = Customer::factory()->create(['name' => 'Nimal Perera']);
        $booking = Booking::create([
            'booking_reference' => 'BKG-CAL-001', 'vehicle_id' => $this->vehicle->id, 'shop_id' => $this->vehicle->shop_id,
            'customer_id' => $customer->id, 'pickup_at' => now()->addDays(3), 'return_at' => now()->addDays(4), 'rental_days' => 1,
            'status' => Booking::STATUS_CONFIRMED,
        ]);
        $day = now()->addDays(3)->toDateString();
        VehicleAvailability::create(['vehicle_id' => $this->vehicle->id, 'date' => $day, 'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $booking->id]);

        $this->asOwner()
            ->getJson('/api/vehicles-availability?from=' . now()->toDateString() . '&to=' . now()->addDays(10)->toDateString())
            ->assertOk()
            ->assertJsonPath('data.rows.0.date', $day)
            ->assertJsonPath('data.rows.0.status', 'booked')
            ->assertJsonPath('data.rows.0.booking.reference', 'BKG-CAL-001')
            ->assertJsonPath('data.rows.0.booking.customer', 'Nimal Perera');
    }

    public function test_a_future_day_can_be_blocked_and_unblocked_but_not_a_past_one(): void
    {
        $day = now()->addDays(2)->toDateString();

        $this->asOwner()->postJson("/api/vehicles/{$this->vehicle->id}/availability/block", ['from' => $day, 'to' => $day])->assertOk();
        $this->assertSame(VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::where('vehicle_id', $this->vehicle->id)->value('status'));

        $this->asOwner()->postJson("/api/vehicles/{$this->vehicle->id}/availability/unblock", ['from' => $day, 'to' => $day])->assertOk();
        $this->assertSame(0, VehicleAvailability::where('vehicle_id', $this->vehicle->id)->count());

        $past = now()->subDays(5)->toDateString();
        $this->asOwner()->postJson("/api/vehicles/{$this->vehicle->id}/availability/block", ['from' => $past, 'to' => $past])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('from');
    }
}
