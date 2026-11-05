<?php

namespace Tests\Feature;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehiclePricing;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Platform Owner deletes a booking (soft delete, with a reason) — not while it's live or disputed. */
class PlatformBookingDeleteTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Vehicle $vehicle;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::withoutGlobalScopes()->create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $this->customer = Customer::factory()->create();
    }

    private function booking(string $status): Booking
    {
        return Booking::withoutGlobalScopes()->create([
            'booking_reference' => 'BKG-DEL-' . Str::upper(Str::random(5)), 'vehicle_id' => $this->vehicle->id,
            'shop_id' => $this->vehicle->shop_id, 'customer_id' => $this->customer->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(7), 'rental_days' => 2, 'status' => $status,
        ]);
    }

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    public function test_the_platform_owner_deletes_a_closed_booking_with_a_reason(): void
    {
        $booking = $this->booking(Booking::STATUS_CANCELLED_BY_CUSTOMER);
        $owner = SystemAdmin::factory()->owner()->create();

        $this->as($owner)->deleteJson("/api/platform/bookings/{$booking->booking_reference}", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->as($owner)->deleteJson("/api/platform/bookings/{$booking->booking_reference}", ['reason' => 'Test booking'])->assertOk();

        $this->assertSoftDeleted('bookings', ['id' => $booking->id]);
        $this->as($owner)->getJson("/api/platform/bookings/{$booking->booking_reference}")->assertNotFound();
        $this->assertTrue(AuditLog::where('action', 'delete')->where('form', 'Booking')->where('record_id', $booking->id)->exists());
    }

    public function test_only_the_platform_owner_can_delete(): void
    {
        $booking = $this->booking(Booking::STATUS_EXPIRED);

        $this->as(SystemAdmin::factory()->create())->deleteJson("/api/platform/bookings/{$booking->booking_reference}", ['reason' => 'x'])->assertForbidden();
        $this->assertNotSoftDeleted('bookings', ['id' => $booking->id]);
    }

    public function test_a_live_booking_cannot_be_deleted(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        foreach ([Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE] as $status) {
            $booking = $this->booking($status);
            $this->as($owner)->deleteJson("/api/platform/bookings/{$booking->booking_reference}", ['reason' => 'x'])
                ->assertUnprocessable()->assertJsonValidationErrors('booking');
            $this->assertNotSoftDeleted('bookings', ['id' => $booking->id]);
        }
    }

    public function test_a_booking_with_an_open_dispute_cannot_be_deleted(): void
    {
        $booking = $this->booking(Booking::STATUS_COMPLETED);
        Dispute::create([
            'dispute_reference' => 'DSP-' . Str::upper(Str::random(6)), 'booking_id' => $booking->id, 'raised_by_user_id' => $this->owner->id,
            'raised_by_side' => 'owner', 'against_side' => 'customer', 'category' => 'damage',
            'subject' => 'Scratch', 'description' => 'Door scratched', 'status' => Dispute::STATUS_OPEN,
        ]);

        $this->as(SystemAdmin::factory()->owner()->create())->deleteJson("/api/platform/bookings/{$booking->booking_reference}", ['reason' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('booking');
    }

    public function test_deleting_frees_the_bookings_days_on_the_vehicle_calendar(): void
    {
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 0]);
        $deleted = $this->booking(Booking::STATUS_COMPLETED);
        $other = $this->booking(Booking::STATUS_COMPLETED);
        $day = fn (int $n) => now()->startOfDay()->addDays($n)->toDateString();
        VehicleAvailability::create(['vehicle_id' => $this->vehicle->id, 'date' => $day(2), 'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $deleted->id]);
        VehicleAvailability::create(['vehicle_id' => $this->vehicle->id, 'date' => $day(4), 'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $other->id]);

        $this->as(SystemAdmin::factory()->owner()->create())
            ->deleteJson("/api/platform/bookings/{$deleted->booking_reference}", ['reason' => 'Test booking'])->assertOk();

        $this->assertSame(0, VehicleAvailability::where('booking_id', $deleted->id)->count());
        $this->getJson("/api/public/vehicles/{$this->vehicle->slug}/availability")
            ->assertOk()
            ->assertJsonPath('data.unavailable_dates', [$day(4)]); // only the other booking's day is still taken
    }
}

