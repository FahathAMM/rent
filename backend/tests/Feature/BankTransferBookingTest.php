<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\OwnerBankDetail;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use App\Services\BankTransferService;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Bank transfer to the shop: the customer uploads a receipt for an advance
 * (the shop's advance_percentage of the total - 5% here) or the full amount, the shop verifies
 * it against its own statement, and any balance is collected in cash at
 * handover. An uploaded receipt alone never counts as paid.
 */
class BankTransferBookingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Customer $customer;
    private RentalShop $shop;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(BankTransferService::PROOF_DISK);

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id, 'advance_percentage' => 5]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        OwnerBankDetail::create([
            'shop_id' => $this->shop->id, 'account_holder_name' => 'Aqua Rentals', 'bank_name' => 'Commercial Bank',
            'branch_name' => 'Kandy', 'account_number' => '8001234567', 'account_number_last4' => '4567', 'is_primary' => true,
        ]);

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $this->shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->customer = Customer::factory()->create();
        $this->booking = Booking::create([
            'booking_reference' => 'BKG-BANK-001', 'vehicle_id' => $vehicle->id, 'shop_id' => $this->shop->id,
            'customer_id' => $this->customer->id,
            'pickup_at' => now()->addDays(5)->startOfDay(), 'return_at' => now()->addDays(8)->startOfDay(), 'rental_days' => 3,
            'status' => Booking::STATUS_PENDING, 'payment_method' => Booking::METHOD_BANK_TRANSFER,
        ]);
        BookingPricing::create([
            'booking_id' => $this->booking->id, 'currency' => 'LKR',
            'pricing_snapshot' => ['security_deposit' => 5000, 'deposit_method' => 'cash_on_pickup'],
            'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => 21000, 'subtotal' => 21000, 'security_deposit' => 5000, 'total_payable' => 26000,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'BKG-BANK-001'),
        ]);

        app(TransitionBooking::class)->accept($this->booking->fresh(), $this->owner->id);
    }

    private function customerToken(): string
    {
        return $this->customer->createToken('c')->plainTextToken;
    }

    private function upload(float $amount): \Illuminate\Testing\TestResponse
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->post('/api/bookings/BKG-BANK-001/transfers', [
                'amount' => $amount,
                'transfer_reference' => 'TRX-991',
                'proof' => UploadedFile::fake()->create('receipt.pdf', 120, 'application/pdf'),
            ], ['Accept' => 'application/json']);
    }

    private function transfers(): BankTransferService
    {
        return app(BankTransferService::class);
    }

    public function test_accepting_keeps_bank_transfer_and_shows_the_customer_the_account(): void
    {
        $this->assertSame(Booking::METHOD_BANK_TRANSFER, $this->booking->fresh()->payment_method);
        $this->assertSame(Booking::STATUS_CONFIRMED, $this->booking->fresh()->status);

        $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->getJson('/api/bookings/BKG-BANK-001')
            ->assertOk()
            ->assertJsonPath('data.bank_details.account_number', '8001234567')
            ->assertJsonPath('data.transfer_options.0', ['key' => 'advance', 'amount' => 1300])
            ->assertJsonPath('data.transfer_options.1', ['key' => 'full', 'amount' => 26000])
            ->assertJsonPath('data.minimum_transfer', 1300)
            ->assertJsonPath('data.balance_due', 26000);
    }

    public function test_an_uploaded_receipt_is_pending_until_the_shop_verifies_it(): void
    {
        $this->upload(1300)->assertCreated()->assertJsonPath('data.payments.0.type', 'booking_charge')->assertJsonPath('data.payments.1.type', 'security_deposit')->assertJsonPath('data.payments.2.status', 'pending');

        $payment = Payment::money()->where('booking_id', $this->booking->id)->firstOrFail();
        $this->assertSame('bank', $payment->method);
        $this->assertNotNull($payment->proof);
        Storage::disk(BankTransferService::PROOF_DISK)->assertExists($payment->proof->file_path);
        $this->assertSame(Booking::PAYMENT_UNPAID, $this->booking->fresh()->payment_status, 'a receipt alone is not money received');

        $this->transfers()->verify($this->booking->fresh(), $payment, $this->owner->id);

        $booking = $this->booking->fresh();
        $this->assertSame(Booking::PAYMENT_PARTIALLY_PAID, $booking->payment_status);
        $this->assertEquals(24700, $booking->balanceDue());
    }

    public function test_the_first_transfer_must_cover_the_advance_and_never_exceed_the_balance(): void
    {
        foreach ([1000, 30000] as $amount) {
            $this->upload($amount)->assertUnprocessable()->assertJsonValidationErrors('amount');
        }
        $this->assertSame(0, Payment::money()->where('booking_id', $this->booking->id)->count());

        $this->upload(7000)->assertCreated();
    }

    public function test_after_the_advance_any_amount_up_to_the_balance_can_be_transferred(): void
    {
        $this->upload(1300)->assertCreated();
        $this->transfers()->verify($this->booking->fresh(), Payment::money()->where('booking_id', $this->booking->id)->firstOrFail(), $this->owner->id);

        $this->upload(30000)->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->upload(10000)->assertCreated()->assertJsonPath('data.minimum_transfer', 1);
    }

    public function test_without_an_advance_only_the_full_amount_is_accepted(): void
    {
        $this->shop->update(['advance_percentage' => null]);

        $this->upload(1300)->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->upload(26000)->assertCreated();
    }

    public function test_only_one_receipt_can_wait_for_review_at_a_time(): void
    {
        $this->upload(1300)->assertCreated();
        $this->upload(1300)->assertUnprocessable()->assertJsonValidationErrors('amount');
    }

    public function test_a_rejected_receipt_lets_the_customer_upload_again(): void
    {
        $this->upload(1300)->assertCreated();
        $payment = Payment::money()->where('booking_id', $this->booking->id)->firstOrFail();

        $this->transfers()->reject($this->booking->fresh(), $payment, $this->owner->id, 'Not in our account');

        $this->assertSame(Payment::STATUS_FAILED, $payment->fresh()->status);
        $this->assertSame(Booking::PAYMENT_UNPAID, $this->booking->fresh()->payment_status);
        $this->upload(1300)->assertCreated();
    }

    public function test_full_transfer_marks_paid_and_handover_needs_no_cash(): void
    {
        $this->upload(26000)->assertCreated();
        $this->transfers()->verify($this->booking->fresh(), Payment::money()->where('booking_id', $this->booking->id)->firstOrFail(), $this->owner->id);
        $this->assertSame(Booking::PAYMENT_PAID, $this->booking->fresh()->payment_status);

        $this->booking->update(['pickup_at' => now()->addHour()]);
        $booking = app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, []);

        $this->assertSame(Booking::STATUS_ACTIVE, $booking->status);
        $this->assertSame(0, Payment::money()->where('booking_id', $booking->id)->where('method', 'cash')->count());
        $this->assertSame(SecurityDeposit::STATUS_HELD, $booking->securityDeposit->status);
    }

    public function test_handover_collects_the_balance_in_cash_after_an_advance(): void
    {
        $this->upload(1300)->assertCreated();
        $this->transfers()->verify($this->booking->fresh(), Payment::money()->where('booking_id', $this->booking->id)->firstOrFail(), $this->owner->id);
        $this->booking->update(['pickup_at' => now()->addHour()]);

        try {
            app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, []);
            $this->fail('Handover should require the cash balance.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('cash_received', $e->errors());
        }

        $booking = app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, [], cashReceived: true);

        $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);
        $this->assertEquals(24700, Payment::money()->where('booking_id', $booking->id)->where('method', 'cash')->where('type', 'balance')->value('credit'));
        $this->assertEquals(0, $booking->balanceDue());
    }

    public function test_handover_waits_for_a_pending_receipt_to_be_reviewed(): void
    {
        $this->upload(1300)->assertCreated();
        $this->booking->update(['pickup_at' => now()->addHour()]);

        $this->expectException(ValidationException::class);
        app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, [], cashReceived: true);
    }

    public function test_after_paying_the_customer_must_contact_the_shop_to_cancel(): void
    {
        $this->upload(1300)->assertCreated();

        $this->expectException(ValidationException::class);
        app(TransitionBooking::class)->cancelByCustomer($this->booking->fresh(), $this->customer->id, 'Plans changed');
    }

    public function test_the_shop_can_still_cancel_after_an_advance_and_pending_receipts_close(): void
    {
        $this->upload(1300)->assertCreated();

        $booking = app(TransitionBooking::class)->cancelByOwner($this->booking->fresh(), $this->owner->id, 'Vehicle damaged');

        $this->assertSame(Booking::STATUS_CANCELLED_BY_OWNER, $booking->status);
        $this->assertSame(Payment::STATUS_CANCELLED, Payment::money()->where('booking_id', $booking->id)->value('status'));
    }

    public function test_the_shop_can_record_a_payment_it_received_and_it_counts_straight_away(): void
    {
        $payment = $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 10000, now()->subDay()->toDateTimeString(), null, null);

        $this->assertSame(Payment::STATUS_SUCCEEDED, $payment->status);
        $this->assertSame('cash', $payment->method);
        $this->assertSame($this->owner->id, $payment->verified_by);

        $booking = $this->booking->fresh();
        $this->assertSame(Booking::PAYMENT_PARTIALLY_PAID, $booking->payment_status);
        $this->assertEquals(16000, $booking->balanceDue());
    }

    public function test_recording_the_rest_marks_paid_and_handover_needs_no_cash(): void
    {
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'bank_transfer', 26000, null, 'SLIPS-77',
            UploadedFile::fake()->create('slip.pdf', 50, 'application/pdf'));

        $this->assertSame(Booking::PAYMENT_PAID, $this->booking->fresh()->payment_status);
        $this->assertNotNull(Payment::money()->where('booking_id', $this->booking->id)->firstOrFail()->proof);

        $this->booking->update(['pickup_at' => now()->addHour()]);
        $booking = app(TransitionBooking::class)->handover($this->booking->fresh(), $this->owner->id, []);
        $this->assertSame(Booking::STATUS_ACTIVE, $booking->status);
    }

    public function test_the_customer_sees_payments_the_shop_recorded(): void
    {
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 10000, null, 'R-12', null);

        $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->getJson('/api/bookings/BKG-BANK-001')
            ->assertOk()
            ->assertJsonPath('data.payments.0.type', 'booking_charge')->assertJsonPath('data.payments.2.method', 'cash')
            ->assertJsonPath('data.payments.2.transfer_reference', 'R-12')
            ->assertJsonPath('data.amount_paid', 10000);
    }

    public function test_the_bookings_summary_counts_statuses_and_what_is_still_owed(): void
    {
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 6000, null, null, null);

        $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->getJson('/api/bookings/summary')
            ->assertOk()
            ->assertJsonPath('data.upcoming', 1)
            ->assertJsonPath('data.requested', 0)
            ->assertJsonPath('data.to_pay_count', 1)
            ->assertJsonPath('data.to_pay_amount', 20000);
    }

    public function test_the_customer_can_open_and_download_the_booking_voucher(): void
    {
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 6000, null, null, null);
        $auth = ['Authorization' => 'Bearer ' . $this->customerToken()];

        $inline = $this->withHeaders($auth)->get('/api/bookings/BKG-BANK-001/voucher')->assertOk();
        $this->assertSame('application/pdf', $inline->headers->get('Content-Type'));
        $this->assertStringStartsWith('inline', $inline->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $inline->getContent());

        $download = $this->withHeaders($auth)->get('/api/bookings/BKG-BANK-001/voucher?download=1')->assertOk();
        $this->assertStringContainsString('attachment; filename=booking-BKG-BANK-001.pdf', $download->headers->get('Content-Disposition'));
    }

    public function test_the_shop_can_print_the_same_voucher_but_another_shop_cannot(): void
    {
        $this->seed(MenuSeeder::class); // vendor permissions
        $this->owner->setShopRole('owner');

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('test')->plainTextToken)
            ->get('/api/vendor/bookings/BKG-BANK-001/voucher?download=1')
            ->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename=booking-BKG-BANK-001.pdf', $response->headers->get('Content-Disposition'));

        $otherOwner = User::factory()->create();
        $otherShop = RentalShop::factory()->create(['owner_user_id' => $otherOwner->id]);
        $otherOwner->update(['shop_id' => $otherShop->id]);
        $otherOwner->setShopRole('owner');

        // The guard caches the first request's user for the rest of the test - reset it so the second token is really used.
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $otherOwner->createToken('test')->plainTextToken)
            ->getJson('/api/vendor/bookings/BKG-BANK-001/voucher')
            ->assertNotFound();
    }

    public function test_there_is_no_voucher_before_the_shop_confirms(): void
    {
        // fresh(): $this->booking still holds its pre-accept "pending", so updating it would be a no-op.
        $this->booking->fresh()->update(['status' => Booking::STATUS_PENDING]);

        $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->getJson('/api/bookings/BKG-BANK-001/voucher')
            ->assertStatus(422);
    }

    public function test_the_statement_starts_with_the_booking_charge_and_payments_bring_the_balance_down(): void
    {
        $charge = Payment::where('booking_id', $this->booking->id)->where('type', Payment::TYPE_BOOKING_CHARGE)->firstOrFail();
        $this->assertNull($charge->method, 'a charge is not money');
        $this->assertEquals(21000, $charge->debit, 'rental only');
        $this->assertEquals(21000, $charge->balance);
        $deposit = Payment::where('booking_id', $this->booking->id)->where('type', Payment::TYPE_SECURITY_DEPOSIT)->whereNull('method')->firstOrFail();
        $this->assertEquals(5000, $deposit->debit, 'the deposit is its own line');
        $this->assertEquals(26000, $deposit->balance, 'confirming opens the account with the full total owed');

        $this->upload(1300)->assertCreated();
        $upload = Payment::money()->where('booking_id', $this->booking->id)->firstOrFail();
        $this->assertNull($upload->balance, 'a receipt waiting for review moves no money yet');

        $this->transfers()->verify($this->booking->fresh(), $upload, $this->owner->id);
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 10000, null, null, null);

        $rows = Payment::where('booking_id', $this->booking->id)->orderBy('id')->get();
        $this->assertEquals([21000, 5000, 0, 0], $rows->pluck('debit')->map(fn ($v) => (float) $v)->all());
        $this->assertEquals([0, 0, 1300, 10000], $rows->pluck('credit')->map(fn ($v) => (float) $v)->all());
        $this->assertEquals([21000, 26000, 24700, 14700], $rows->pluck('balance')->map(fn ($v) => (float) $v)->all(), 'balance = what is still owed');
        $this->assertEquals(11300, $this->booking->fresh()->amountPaid(), 'the charge is not counted as paid');
        $this->assertEquals(14700, $this->booking->fresh()->balanceDue());
        $this->assertEquals('1300.00', $rows[2]->summary()['amount'], 'amount stays available for display');
    }

    public function test_cancelling_reverses_the_charge_and_leaves_what_the_shop_holds(): void
    {
        $this->upload(1300)->assertCreated();
        $this->transfers()->verify($this->booking->fresh(), Payment::money()->where('booking_id', $this->booking->id)->firstOrFail(), $this->owner->id);

        app(TransitionBooking::class)->cancelByOwner($this->booking->fresh(), $this->owner->id, 'Vehicle damaged');

        $reversal = Payment::where('booking_id', $this->booking->id)->where('type', Payment::TYPE_ADJUSTMENT)->latest('id')->firstOrFail();
        $this->assertEquals(26000, $reversal->credit);
        $this->assertEquals(-1300, $reversal->balance, 'negative = the shop holds 1,300 of the customer\'s money');
    }

    public function test_a_recorded_payment_cannot_exceed_the_balance(): void
    {
        $this->expectException(ValidationException::class);
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 30000, null, null, null);
    }

    public function test_a_pending_receipt_that_now_exceeds_the_balance_cannot_be_verified(): void
    {
        $this->upload(7000)->assertCreated();
        $this->transfers()->recordByShop($this->booking->fresh(), $this->owner->id, 'cash', 20000, null, null, null);

        $this->expectException(ValidationException::class);
        $this->transfers()->verify($this->booking->fresh(), Payment::where('method', 'bank')->where('booking_id', $this->booking->id)->firstOrFail(), $this->owner->id);
    }

    public function test_the_vendor_endpoint_records_a_payment(): void
    {
        $this->seed(MenuSeeder::class); // vendor permissions
        $this->owner->setShopRole('owner');

        // Real bearer token, not actingAs() - see ShopBoundaryTest's docblock.
        $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('test')->plainTextToken)
            ->post('/api/vendor/bookings/BKG-BANK-001/payments', ['method' => 'cash', 'amount' => 5000, 'paid_at' => now()->subMinutes(10)->toISOString()], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.balance_due', 21000);
    }

    public function test_shops_without_a_bank_account_only_take_cash(): void
    {
        OwnerBankDetail::where('shop_id', $this->shop->id)->delete();
        VehiclePricing::create(['vehicle_id' => $this->booking->vehicle_id, 'daily_rate' => 7000, 'advance_notice_hours' => 0, 'min_rental_days' => 1]);
        $this->shop->update(['status' => 'active', 'is_published' => true]);

        $this->withHeader('Authorization', 'Bearer ' . $this->customerToken())
            ->postJson('/api/bookings', [
                'vehicle_id' => $this->booking->vehicle_id,
                'pickup_at' => now()->addDays(20)->toDateTimeString(),
                'return_at' => now()->addDays(22)->toDateTimeString(),
                'payment_method' => 'bank_transfer',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_method');
    }
}
