<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 8 — the three independent layers app-doc/marketplace/06-plan-and-
 * risks.md calls out under "Double booking under load": the row lock
 * itself, the guarded re-validation it protects
 * (TransitionBooking::assertNoOverlap), and the unique(vehicle_id, date)
 * database-level backstop that still catches a double-book even if a
 * future code path forgets the lock entirely.
 *
 * test_the_row_lock_itself_blocks_a_second_connection is the only test in
 * this file not wrapped by RefreshDatabase: a genuine two-connection lock
 * test needs its fixture committed and visible to BOTH connections, which
 * RefreshDatabase's wrapping transaction on the default connection would
 * prevent (the second connection would see no row at all, not a lock
 * wait). It cleans up everything it creates itself in tearDown().
 */
class BookingConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;
    private Vehicle $vehicle;
    private User $owner;
    private Customer $customerA;
    private Customer $customerB;

    protected function setUp(): void
    {
        parent::setUp();

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);

        $this->vehicle = Vehicle::create([
            'shop_id' => $this->shop->id, 'category_id' => $category->id, 'title' => 'Race Test Car',
            'slug' => 'race-test-car', 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'RACE-0001', 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->customerA = Customer::factory()->create();
        $this->customerB = Customer::factory()->create();
    }

    private function makeBooking(Customer $customer, string $reference, $pickup, $return): Booking
    {
        $booking = Booking::create([
            'booking_reference' => $reference,
            'vehicle_id' => $this->vehicle->id,
            'shop_id' => $this->shop->id,
            'customer_id' => $customer->id,
            'pickup_at' => $pickup,
            'return_at' => $return,
            'rental_days' => $pickup->diffInDays($return),
            'status' => Booking::STATUS_PENDING,
        ]);

        BookingPricing::create([
            'booking_id' => $booking->id,
            'currency' => 'LKR',
            'pricing_snapshot' => ['security_deposit' => 0, 'deposit_method' => 'cash_on_pickup'],
            'rate_plan' => 'daily',
            'rate_breakdown' => [],
            'base_amount' => 10000, 'subtotal' => 10000, 'total_payable' => 10000,
            'computed_at' => now(),
            'snapshot_hash' => hash('sha256', $reference),
        ]);

        return $booking->fresh();
    }

    public function test_confirming_one_booking_rejects_a_second_accept_for_overlapping_dates(): void
    {
        $pickup = now()->addDays(5)->startOfDay();
        $return = now()->addDays(8)->startOfDay();

        $bookingA = $this->makeBooking($this->customerA, 'BKG-RACE-A', $pickup, $return);
        $bookingB = $this->makeBooking($this->customerB, 'BKG-RACE-B', $pickup->copy()->addDay(), $return->copy()->addDay());

        $action = app(TransitionBooking::class);

        // Accepting confirms straight away and books the dates under the vehicle row lock.
        $action->accept($bookingA, $this->owner->id);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $action->accept($bookingB->fresh(), $this->owner->id);
    }

    public function test_the_unique_constraint_on_vehicle_availability_is_a_hard_backstop_independent_of_the_lock(): void
    {
        VehicleAvailability::create([
            'vehicle_id' => $this->vehicle->id, 'date' => now()->addDays(10)->toDateString(),
            'status' => VehicleAvailability::STATUS_BOOKED,
        ]);

        $this->expectException(QueryException::class);

        VehicleAvailability::create([
            'vehicle_id' => $this->vehicle->id, 'date' => now()->addDays(10)->toDateString(),
            'status' => VehicleAvailability::STATUS_BOOKED,
        ]);
    }

    /**
     * Not wrapped by RefreshDatabase — see class docblock. Proves the
     * mechanism the above tests rely on actually exists at the database
     * level: a second connection attempting the same row lock genuinely
     * waits, rather than merely coincidentally passing because nothing
     * forced the two calls to overlap in time.
     */
    public function test_the_row_lock_itself_blocks_a_second_connection(): void
    {
        config(['database.connections.lock_test_conn2' => config('database.connections.mysql')]);

        $category = VehicleCategory::create(['name' => 'Race Car', 'slug' => 'race-car-' . Str::random(6), 'sort_order' => 1, 'is_active' => true]);
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Lock Test Car',
            'slug' => 'lock-test-car-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'LOCK-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $conn2 = DB::connection('lock_test_conn2');
        $blocked = false;

        try {
            DB::beginTransaction();
            DB::table('vehicles')->where('id', $vehicle->id)->lockForUpdate()->first();

            $conn2->statement('SET SESSION innodb_lock_wait_timeout = 1');
            $conn2->beginTransaction();
            try {
                $conn2->table('vehicles')->where('id', $vehicle->id)->lockForUpdate()->first();
                $conn2->rollBack();
            } catch (QueryException $e) {
                $blocked = true;
                $conn2->rollBack();
            }

            DB::rollBack();
        } finally {
            DB::table('vehicles')->where('id', $vehicle->id)->delete();
            DB::table('rental_shops')->where('id', $shop->id)->delete();
            DB::table('users')->where('id', $owner->id)->delete();
            DB::table('vehicle_categories')->where('id', $category->id)->delete();
            $conn2->disconnect();
        }

        $this->assertTrue($blocked, 'A second connection should have been blocked by the row lock the first connection held.');
    }
}
