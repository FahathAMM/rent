<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Cash bookings are paid to the shop at pickup: accepting confirms straight
 * away, and handover records the cash and marks it paid.
 */
class CashBookingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Customer $customer;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $shop->id]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->customer = Customer::factory()->create();
        $this->booking = Booking::create([
            'booking_reference' => 'BKG-CASH-001', 'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id,
            'customer_id' => $this->customer->id,
            'pickup_at' => now()->addDays(5)->startOfDay(), 'return_at' => now()->addDays(8)->startOfDay(), 'rental_days' => 3,
            'status' => Booking::STATUS_PENDING,
        ]);
        BookingPricing::create([
            'booking_id' => $this->booking->id, 'currency' => 'LKR',
            'pricing_snapshot' => ['security_deposit' => 5000, 'deposit_method' => 'prepaid'],
            'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => 21000, 'subtotal' => 21000, 'security_deposit' => 5000, 'total_payable' => 26000,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'BKG-CASH-001'),
        ]);
    }

    private function accept(): Booking
    {
        return app(TransitionBooking::class)->accept($this->booking->fresh(), $this->owner->id);
    }

    public function test_accepting_confirms_a_cash_booking_and_books_the_dates(): void
    {
        $booking = $this->accept();

        $this->assertSame(Booking::STATUS_CONFIRMED, $booking->status);
        $this->assertSame(Booking::METHOD_CASH, $booking->payment_method);
        $this->assertSame(Booking::PAYMENT_UNPAID, $booking->payment_status);
        $this->assertSame(3, VehicleAvailability::where('booking_id', $booking->id)->count());
        // Even a "prepaid" deposit setting is taken by the shop at pickup - nothing is paid through the platform.
        $this->assertSame('cash_on_pickup', $booking->securityDeposit->hold_method);
        $this->assertEquals(0, $booking->securityDeposit->amount_collected);
    }

    private function handOver(bool $cashReceived = true): Booking
    {
        $this->accept();
        $this->booking->update(['pickup_at' => now()->addHour()]);

        return app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, ['odometer_reading' => 1000], $cashReceived);
    }

    public function test_handover_records_the_cash_and_holds_the_deposit(): void
    {
        $booking = $this->handOver();

        $this->assertSame(Booking::STATUS_ACTIVE, $booking->status);
        $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);

        $payments = Payment::money()->where('booking_id', $booking->id)->where('method', 'cash')->pluck('credit', 'type');
        $this->assertEquals(21000, $payments['rental']);
        $this->assertEquals(5000, $payments['security_deposit']);

        $deposit = $booking->securityDeposit;
        $this->assertSame(SecurityDeposit::STATUS_HELD, $deposit->status);
        $this->assertEquals(5000, $deposit->amount_collected);
        $this->assertNotNull($deposit->collected_at);
    }

    public function test_handover_is_refused_until_the_cash_is_confirmed(): void
    {
        try {
            $this->handOver(cashReceived: false);
            $this->fail('Handover should require cash confirmation.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('cash_received', $e->errors());
        }

        $this->assertSame(Booking::STATUS_CONFIRMED, $this->booking->fresh()->status);
        $this->assertSame(0, Payment::money()->where('booking_id', $this->booking->id)->count());
    }

    public function test_return_releases_the_deposit_in_full_by_default(): void
    {
        $booking = app(TransitionBooking::class)->returnVehicle($this->handOver(), $this->owner->id, []);

        $deposit = $booking->securityDeposit;
        $this->assertSame(SecurityDeposit::STATUS_RELEASED, $deposit->status);
        $this->assertEquals(0, $deposit->deductions_amount);
        $this->assertNotNull($deposit->released_at);

        // Statement: deposit closed, all 5,000 handed back in cash, nothing owed.
        $this->assertSettlement($booking, released: 5000, damage: null, handedBack: 5000);
    }

    /** The lines posted at return, and that the statement ends settled. */
    private function assertSettlement(Booking $booking, float $released, ?float $damage, ?float $handedBack): void
    {
        $lines = Payment::where('booking_id', $booking->id)->where('status', Payment::STATUS_SUCCEEDED)->get();

        $release = $lines->where('type', Payment::TYPE_DEPOSIT_RELEASE);
        $this->assertCount(1, $release);
        $this->assertEquals($released, $release->first()->credit);
        $this->assertNull($release->first()->method);

        $kept = $lines->where('type', Payment::TYPE_DAMAGE);
        $this->assertCount($damage === null ? 0 : 1, $kept);
        if ($damage !== null) {
            $this->assertEquals($damage, $kept->first()->debit);
            $this->assertNotEmpty($kept->first()->note);
        }

        $back = $lines->where('type', Payment::TYPE_SECURITY_DEPOSIT)->where('method', Payment::METHOD_CASH)->where('debit', '>', 0);
        $this->assertCount($handedBack === null ? 0 : 1, $back);
        if ($handedBack !== null) {
            $this->assertEquals($handedBack, $back->first()->debit);
        }

        $this->assertEquals(0, $lines->sum(fn ($l) => (float) $l->debit - (float) $l->credit), 'debits and credits net to zero');
        $this->assertEquals(0, $lines->sortBy('id')->last()->balance, 'the last line leaves nothing owed');
        $this->assertEquals(0, $booking->fresh()->balanceDue());
    }

    public function test_return_records_a_partial_deposit_deduction(): void
    {
        $booking = app(TransitionBooking::class)->returnVehicle($this->handOver(), $this->owner->id, [], [], 1500, 'Scratched bumper');

        $deposit = $booking->securityDeposit;
        $this->assertSame(SecurityDeposit::STATUS_PARTIALLY_RELEASED, $deposit->status);
        $this->assertEquals(1500, $deposit->deductions_amount);
        $this->assertSame('Scratched bumper', $deposit->deduction_reason);
        $this->assertSame($this->owner->id, $deposit->decided_by);

        // Statement: deposit closed, 1,500 kept for damage (with the reason), 3,500 handed back.
        $this->assertSettlement($booking, released: 5000, damage: 1500, handedBack: 3500);
        $this->assertSame('Scratched bumper', Payment::where('booking_id', $booking->id)->where('type', Payment::TYPE_DAMAGE)->value('note'));
    }

    public function test_keeping_the_whole_deposit_hands_nothing_back(): void
    {
        $booking = app(TransitionBooking::class)->returnVehicle($this->handOver(), $this->owner->id, [], [], 5000, 'Write-off repair');

        $this->assertSame(SecurityDeposit::STATUS_FORFEITED, $booking->securityDeposit->status);
        $this->assertSettlement($booking, released: 5000, damage: 5000, handedBack: null);
    }

    public function test_deposit_deduction_needs_a_reason_and_cannot_exceed_the_deposit(): void
    {
        $active = $this->handOver();

        foreach ([[1500, null, 'deposit_deduction_reason'], [6000, 'Total loss', 'deposit_deduction']] as [$amount, $reason, $field]) {
            try {
                app(TransitionBooking::class)->returnVehicle($active->fresh(), $this->owner->id, [], [], $amount, $reason);
                $this->fail("Deduction of {$amount} should be refused.");
            } catch (ValidationException $e) {
                $this->assertArrayHasKey($field, $e->errors());
            }
        }

        $this->assertSame(Booking::STATUS_ACTIVE, $active->fresh()->status);
    }

    public function test_no_show_frees_the_booked_dates(): void
    {
        $booking = app(TransitionBooking::class)->noShow($this->accept());

        $this->assertSame(Booking::STATUS_NO_SHOW, $booking->status);
        $this->assertSame(0, VehicleAvailability::where('booking_id', $booking->id)->count());
    }

    public function test_customer_can_cancel_a_confirmed_cash_booking_before_pickup_and_the_dates_free_up(): void
    {
        $this->accept();

        $booking = app(TransitionBooking::class)->cancelByCustomer($this->booking->fresh(), $this->customer->id, 'Plans changed');

        $this->assertSame(Booking::STATUS_CANCELLED_BY_CUSTOMER, $booking->status);
        $this->assertSame(0, VehicleAvailability::where('booking_id', $booking->id)->count());
    }

    public function test_once_paid_it_can_no_longer_be_cancelled_for_free(): void
    {
        $active = $this->handOver();

        $this->expectException(ValidationException::class);
        app(TransitionBooking::class)->cancelByOwner($active, $this->owner->id, 'Too late');
    }
}
