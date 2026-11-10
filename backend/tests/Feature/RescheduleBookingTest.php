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

    public function test_extending_to_ten_days_uses_the_quoted_weekly_rate_plus_daily(): void
    {
        $this->booking->pricing->update(['pricing_snapshot' => $this->booking->pricing->pricing_snapshot + ['weekly_rate' => 40000, 'monthly_rate' => 150000]]);
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 9000, 'weekly_rate' => 50000]);

        $booking = $this->move(8, 10);

        $this->assertEquals(40000 + 3 * 7000, $booking->pricing->base_amount, '1 week + 3 days at the quoted rates');
        $this->assertSame('mixed', $booking->pricing->rate_plan);

        $booking = $this->move(8, 30);

        $this->assertEquals(150000, $booking->pricing->base_amount, '30 days = 1 month');
        $this->assertSame('monthly', $booking->pricing->rate_plan);
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

    /** Hand the 3-day booking over: 26,000 paid in cash (21,000 rental + 5,000 deposit), pickup in an hour. */
    private function handedOver(): Booking
    {
        $pickup = now()->addHour();
        $this->booking->update(['pickup_at' => $pickup, 'return_at' => $pickup->copy()->addDays(3)]);
        VehicleAvailability::where('booking_id', $this->booking->id)->delete();
        for ($day = 0; $day < 3; $day++) {
            VehicleAvailability::create([
                'vehicle_id' => $this->vehicle->id, 'date' => $pickup->copy()->addDays($day)->toDateString(),
                'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $this->booking->id,
            ]);
        }

        return app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, [], cashReceived: true);
    }

    private function changeReturn(Booking $booking, int $days, ?string $refundMethod = null): Booking
    {
        return app(TransitionBooking::class)->reschedule($booking->fresh(), $this->owner->id, $booking->pickup_at, $booking->pickup_at->copy()->addDays($days), null, $refundMethod);
    }

    public function test_extending_after_handover_reprices_at_the_quoted_rate_and_leaves_a_balance(): void
    {
        $booking = $this->handedOver();
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 9000]);

        $booking = $this->changeReturn($booking, 5);

        $this->assertSame(Booking::STATUS_ACTIVE, $booking->status);
        $this->assertSame(5, $booking->rental_days);
        $this->assertEquals(40000, $booking->pricing->total_payable, '5 days × 7,000 + 5,000 deposit');
        $this->assertEquals(14000, $booking->balanceDue());
        $this->assertSame(Booking::PAYMENT_PARTIALLY_PAID, $booking->payment_status);
        $this->assertCount(5, $this->bookedDates($booking));
    }

    public function test_extending_into_the_next_booking_is_refused(): void
    {
        $booking = $this->handedOver();
        $this->makeConfirmedBooking('BKG-NEXT-001', now()->addDays(4)->startOfDay()->addHours(10), 2);

        try {
            $this->changeReturn($booking, 6);
            $this->fail('Extending over another booking should be refused.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $this->assertEquals(26000, $booking->fresh()->pricing->total_payable);
    }

    public function test_shortening_after_handover_needs_the_refund_and_records_it(): void
    {
        $booking = $this->handedOver();

        try {
            $this->changeReturn($booking, 2);
            $this->fail('Shortening without a refund method should be refused.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('refund_method', $e->errors());
        }
        $this->assertEquals(26000, $booking->fresh()->pricing->total_payable);

        $booking = $this->changeReturn($booking, 2, Booking::METHOD_BANK_TRANSFER);

        $this->assertEquals(19000, $booking->pricing->total_payable);
        $this->assertEquals(19000, $booking->amountPaid());
        $this->assertEquals(0, $booking->balanceDue());
        $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);
        $this->assertCount(2, $this->bookedDates($booking));

        $refund = Payment::where('booking_id', $booking->id)->where('type', 'balance')->firstOrFail();
        $this->assertSame(Payment::METHOD_BANK, $refund->method);
        $this->assertEquals(7000, $refund->debit);
        $this->assertEquals(0, Payment::where('booking_id', $booking->id)->where('status', 'succeeded')->latest('id')->value('balance'), 'statement balance = balance due');
    }

    public function test_earnings_follow_a_refund_after_shortening(): void
    {
        $this->seed(MenuSeeder::class); // vendor permissions
        $this->owner->setShopRole('owner');

        $this->changeReturn($this->handedOver(), 2, Booking::METHOD_CASH);

        $summary = $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('o')->plainTextToken)
            ->getJson('/api/vendor/earnings')
            ->assertOk()
            ->json('data.summary');

        $this->assertEquals(14000, $summary['earnings_amount'], '2 days × 7,000');
        $this->assertEquals(14000, $summary['received_amount'], '21,000 rental taken less 7,000 paid back');
        $this->assertEquals(0, $summary['pending_amount']);
    }

    public function test_the_pickup_cannot_move_after_handover(): void
    {
        $booking = $this->handedOver();
        $pickup = $booking->pickup_at->copy();
        $newPickup = now()->addDays(10);

        $booking = app(TransitionBooking::class)->reschedule($booking->fresh(), $this->owner->id, $newPickup, $pickup->copy()->addDays(4));

        $this->assertTrue($booking->pickup_at->equalTo($pickup));
        $this->assertSame(4, $booking->rental_days);
    }

    public function test_the_return_cannot_be_before_the_actual_pickup(): void
    {
        $booking = $this->handedOver();

        $this->expectException(ValidationException::class);
        app(TransitionBooking::class)->reschedule($booking->fresh(), $this->owner->id, $booking->pickup_at, $booking->actual_pickup_at->copy()->subMinute());
    }

    public function test_dates_cannot_change_once_returned(): void
    {
        $booking = app(TransitionBooking::class)->returnVehicle($this->handedOver(), $this->owner->id, []);

        $this->expectException(ValidationException::class);
        $this->changeReturn($booking, 5);
    }

    public function test_an_extension_balance_can_be_paid_after_the_return_and_the_deposit_still_settles(): void
    {
        $booking = $this->changeReturn($this->handedOver(), 4);

        $booking = app(TransitionBooking::class)->returnVehicle($booking->fresh(), $this->owner->id, []);
        $this->assertSame(Booking::STATUS_COMPLETED, $booking->status);
        $this->assertEquals(7000, $booking->balanceDue(), 'the deposit going back does not touch what the extension owes');

        app(BankTransferService::class)->recordByShop($booking->fresh(), $this->owner->id, 'cash', 7000, null, null, null);

        $booking = $booking->fresh();
        $this->assertEquals(0, $booking->balanceDue());
        $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);
    }

    public function test_returning_early_frees_today_so_a_same_day_booking_can_be_accepted(): void
    {
        $booking = app(TransitionBooking::class)->returnVehicle($this->handedOver(), $this->owner->id, []);

        $this->assertSame([], array_filter($this->bookedDates($booking), fn ($date) => $date >= now()->toDateString()));

        $next = $this->makeConfirmedBooking('BKG-SAME-DAY', now()->addHours(2), 1);
        $this->assertSame(Booking::STATUS_CONFIRMED, $next->status);
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
            $original->pickup_at->format('d M Y'),
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
            ->assertJsonPath('data.current_total', 26000)
            ->assertJsonPath('data.breakdown.rate_breakdown.0.plan', 'daily')
            ->assertJsonPath('data.breakdown.rate_breakdown.0.units', 2)
            ->assertJsonPath('data.breakdown.base_amount', 14000);
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
