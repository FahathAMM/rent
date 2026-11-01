<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use App\Services\BankTransferService;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * The shop changes a confirmed booking's dates: same booking and payments,
 * days moved under the vehicle lock, price recalculated from the rates the
 * customer was quoted (not today's), payment status following what's paid.
 */
class RescheduleBookingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Customer $customer;
    private Vehicle $vehicle;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $shop->id]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->customer = Customer::factory()->create();
        $this->booking = $this->makeConfirmedBooking('BKG-MOVE-001', now()->addDays(5)->startOfDay()->addHours(10), 3);
    }

    /** A confirmed booking at 7,000/day + 5,000 cash deposit, with its days booked. */
    private function makeConfirmedBooking(string $reference, $pickup, int $days): Booking
    {
        $booking = Booking::create([
            'booking_reference' => $reference, 'vehicle_id' => $this->vehicle->id, 'shop_id' => $this->vehicle->shop_id,
            'customer_id' => $this->customer->id, 'pickup_at' => $pickup, 'return_at' => $pickup->copy()->addDays($days),
            'rental_days' => $days, 'status' => Booking::STATUS_PENDING, 'payment_method' => Booking::METHOD_CASH,
        ]);
        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR',
            'pricing_snapshot' => ['currency' => 'LKR', 'daily_rate' => 7000, 'security_deposit' => 5000, 'deposit_method' => 'cash_on_pickup', 'tax_rate' => 0],
            'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => 7000 * $days, 'subtotal' => 7000 * $days, 'security_deposit' => 5000, 'total_payable' => 7000 * $days + 5000,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', $reference),
        ]);

        return app(TransitionBooking::class)->accept($booking->fresh(), $this->owner->id);
    }

    private function move(int $startInDays, int $days, ?string $reason = null): Booking
    {
        $pickup = now()->addDays($startInDays)->startOfDay()->addHours(10);

        return app(TransitionBooking::class)->reschedule($this->booking->fresh(), $this->owner->id, $pickup, $pickup->copy()->addDays($days), $reason);
    }

    private function bookedDates(Booking $booking): array
    {
        return VehicleAvailability::where('booking_id', $booking->id)->orderBy('date')->pluck('date')
            ->map(fn ($d) => $d->toDateString())->all();
    }

    public function test_moving_the_dates_keeps_the_booking_and_payments_and_reprices_it(): void
    {
        app(BankTransferService::class)->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 10000, null, null, null);
        $oldDates = $this->bookedDates($this->booking);

        $booking = $this->move(12, 5, 'Customer flight moved');

        $this->assertSame('BKG-MOVE-001', $booking->booking_reference);
        $this->assertSame(Booking::STATUS_CONFIRMED, $booking->status);
        $this->assertSame(5, $booking->rental_days);
        $this->assertEquals(35000, $booking->pricing->base_amount);
        $this->assertEquals(40000, $booking->pricing->total_payable, '5 days × 7,000 + 5,000 deposit');
        $this->assertSame(1, Payment::money()->where('booking_id', $booking->id)->count(), 'payments stay on the same booking');
        $this->assertSame(Booking::PAYMENT_PARTIALLY_PAID, $booking->payment_status);
        $this->assertEquals(30000, $booking->balanceDue());

        // The price difference is on the statement: 26,000 → 40,000 = +14,000 owed.
        $adjustment = Payment::where('booking_id', $booking->id)->where('type', Payment::TYPE_ADJUSTMENT)->firstOrFail();
        $this->assertEquals(14000, $adjustment->debit);
        $this->assertEquals(30000, Payment::where('booking_id', $booking->id)->where('status', 'succeeded')->latest('id')->value('balance'), 'statement balance = balance due');

        $newDates = $this->bookedDates($booking);
        $this->assertCount(5, $newDates);
        $this->assertSame(now()->addDays(12)->toDateString(), $newDates[0]);
        $this->assertEmpty(array_intersect($oldDates, $newDates));

        $log = BookingStatusHistory::where('booking_id', $booking->id)->where('field', 'dates')->first();
        $this->assertNotNull($log);
        $this->assertSame('Customer flight moved', $log->reason);
    }

    public function test_it_uses_the_rates_the_customer_was_quoted_not_todays(): void
    {
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 9000]);

        $booking = $this->move(8, 3);

        $this->assertEquals(21000, $booking->pricing->base_amount);
    }

    public function test_overlapping_dates_are_refused_and_nothing_changes(): void
    {
        $this->makeConfirmedBooking('BKG-OTHER-001', now()->addDays(20)->startOfDay()->addHours(10), 3);
        $before = $this->bookedDates($this->booking);

        try {
            $this->move(19, 3);
            $this->fail('Overlapping dates should be refused.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $this->assertSame($before, $this->bookedDates($this->booking->fresh()));
        $this->assertEquals(26000, $this->booking->fresh()->pricing->total_payable);
    }

    public function test_a_shorter_trip_can_leave_the_customer_overpaid(): void
    {
        app(BankTransferService::class)->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 26000, null, null, null);
        $pickup = now()->addDays(8)->startOfDay()->addHours(10);

        $preview = app(TransitionBooking::class)->previewReschedule($this->booking->fresh(), $pickup, $pickup->copy()->addDay());
        $this->assertTrue($preview['available']);
        $this->assertEquals(12000, $preview['total_payable']);
        $this->assertEquals(14000, $preview['overpaid']);

        $booking = $this->move(8, 1);
        $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);
        $this->assertEquals(0, $booking->balanceDue());
    }

    public function test_dates_cannot_change_after_handover(): void
    {
        $this->booking->update(['pickup_at' => now()->addHour()]);
        app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, [], cashReceived: true);

        $this->expectException(ValidationException::class);
        $this->move(10, 2);
    }

    public function test_the_customer_booking_and_voucher_note_the_date_change(): void
    {
        $original = $this->booking->fresh();
        $this->move(12, 3, 'Customer flight moved');
        $this->move(14, 2, 'Moved again');

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->customer->createToken('c')->plainTextToken)
            ->getJson('/api/bookings/BKG-MOVE-001')
            ->assertOk()
            ->assertJsonCount(2, 'data.date_changes')
            ->assertJsonPath('data.date_changes.0.reason', 'Moved again');
        $this->assertStringContainsString(
            $original->pickup_at->copy()->setTimezone(config('app.display_timezone'))->format('d M Y'),
            $response->json('data.date_changes.1.from'),
            'the oldest change holds the dates first booked',
        );

        $booking = $this->booking->fresh(['vehicle', 'shop', 'customer', 'pricing', 'payments', 'pickupLocation', 'returnLocation']);
        $html = view('pdf.booking-confirmation', [
            'booking' => $booking, 'shop' => $booking->shop, 'customer' => $booking->customer,
            'vehicle' => $booking->vehicle, 'pricing' => $booking->pricing,
        ])->render();

        $this->assertStringContainsString('Dates changed by the shop', $html);
        $this->assertStringContainsString('Reason: Moved again', $html);
        $this->assertStringContainsString('2 changes in total', $html);
        $this->assertStringContainsString('originally ' . e($response->json('data.date_changes.1.from')), $html);
    }

    public function test_the_shop_endpoints_preview_and_save_but_a_customer_cannot(): void
    {
        $this->seed(MenuSeeder::class); // vendor permissions
        $this->owner->setShopRole('owner');
        $pickup = now()->addDays(15)->startOfDay()->addHours(10);
        $body = ['pickup_at' => $pickup->toISOString(), 'return_at' => $pickup->copy()->addDays(2)->toISOString(), 'reason' => 'Shop request'];
        $owner = ['Authorization' => 'Bearer ' . $this->owner->createToken('o')->plainTextToken];

        $this->withHeaders($owner)->postJson('/api/vendor/bookings/BKG-MOVE-001/reschedule/preview', $body)
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.new_total', 19000)
            ->assertJsonPath('data.current_total', 26000);
        $this->assertEquals(26000, $this->booking->fresh()->pricing->total_payable, 'preview saves nothing');

        $this->withHeaders($owner)->postJson('/api/vendor/bookings/BKG-MOVE-001/reschedule', $body)
            ->assertOk()
            ->assertJsonPath('data.rental_days', 2);

        // The guard caches the first request's user for the rest of the test - reset it so the customer token is really used.
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $this->customer->createToken('c')->plainTextToken)
            ->postJson('/api/vendor/bookings/BKG-MOVE-001/reschedule', $body)
            ->assertUnauthorized(); // a customer token isn't even a valid login on the vendor API
    }
}
