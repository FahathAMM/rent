<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\Role;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehicleSale;
use App\Models\VehicleSaleDetail;
use App\Support\VendorContext;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The vendor reports. Real bearer tokens, not actingAs(): see ShopBoundaryTest's docblock. */
class ShopReportsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $otherOwner;
    private RentalShop $shop;
    private RentalShop $otherShop;
    private VehicleCategory $category;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
        // The seeder's TRUNCATE commits RefreshDatabase's transaction, so reopen it.
        if (!DB::getPdo()->inTransaction()) {
            DB::getPdo()->beginTransaction();
        }

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole('owner');

        $this->otherOwner = User::factory()->create();
        $this->otherShop = RentalShop::factory()->create(['owner_user_id' => $this->otherOwner->id]);
        $this->otherOwner->update(['shop_id' => $this->otherShop->id]);
        $this->otherOwner->setShopRole('owner');

        $this->category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->customer = Customer::factory()->create(['name' => 'Amal Silva']);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();
        VendorContext::forget();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken);
    }

    private function vehicle(string $title, array $attributes = []): Vehicle
    {
        VendorContext::forget();

        return Vehicle::withoutGlobalScopes()->create($attributes + [
            'shop_id' => $this->shop->id, 'category_id' => $this->category->id, 'title' => $title,
            'slug' => 'car-' . Str::lower(Str::random(8)), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAB-' . random_int(1000, 9999), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function booking(Vehicle $vehicle, float $subtotal, string $status = Booking::STATUS_COMPLETED, ?float $paid = null): Booking
    {
        $booking = Booking::withoutGlobalScopes()->create([
            'booking_reference' => 'BKG-' . Str::upper(Str::random(8)), 'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id,
            'customer_id' => $this->customer->id, 'pickup_at' => '2026-03-10 10:00:00', 'return_at' => '2026-03-13 10:00:00',
            'rental_days' => 3, 'status' => $status,
        ]);
        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => [], 'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => $subtotal, 'subtotal' => $subtotal, 'total_payable' => $subtotal,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', $booking->booking_reference),
        ]);

        if ($paid !== null) {
            DB::table('payments')->insert([
                'booking_id' => $booking->id, 'payment_reference' => 'PAY-' . Str::random(8), 'idempotency_key' => Str::random(16), 'type' => 'rental', 'method' => 'cash',
                'credit' => $paid, 'debit' => 0, 'status' => Payment::STATUS_SUCCEEDED, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $booking;
    }

    private function expense(float $total, ?Vehicle $vehicle = null): void
    {
        VendorContext::forget();
        $category = ExpenseCategory::withoutGlobalScopes()->firstOrCreate(['shop_id' => $this->shop->id, 'name' => 'Repairs']);

        Expense::withoutGlobalScopes()->create([
            'shop_id' => $this->shop->id, 'vehicle_id' => $vehicle?->id, 'expense_number' => 'EXP-' . Str::random(6), 'expense_category_id' => $category->id,
            'expense_date' => '2026-03-15', 'subtotal' => $total, 'total' => $total,
        ]);
    }

    private function sale(Vehicle $vehicle, float $asking, float $sold): void
    {
        VehicleSaleDetail::create(['vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'price' => $asking, 'mileage_km' => 1000, 'condition' => 'used', 'sale_status' => 'sold']);
        VehicleSale::withoutGlobalScopes()->create([
            'reference' => 'SAL-' . Str::upper(Str::random(8)), 'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id,
            'buyer_name' => 'Nimal', 'buyer_phone' => '0771234567', 'buyer_nic' => '901234567V',
            'sale_price' => $sold, 'payment_method' => 'cash', 'sold_at' => '2026-03-20 12:00:00',
        ]);
    }

    private function report(string $name, User $user = null)
    {
        return $this->as($user ?? $this->owner)->getJson("/api/vendor/reports/{$name}?from=2026-01-01&to=2026-12-31")->assertOk();
    }

    /**
     * The earnings list works figures out per row, while the summary, dashboard and
     * reports add every payment up in one pass (ShopEarningsQuery rows() vs totals()).
     * Both must give the same money for every kind of statement line.
     */
    public function test_earnings_list_summary_and_dashboard_agree(): void
    {
        $car = $this->vehicle('Aqua');
        $line = fn (Booking $b, string $type, ?string $method, float $credit, float $debit, string $status = Payment::STATUS_SUCCEEDED, bool $deleted = false) => DB::table('payments')->insert([
            'booking_id' => $b->id, 'payment_reference' => 'PAY-' . Str::random(10), 'idempotency_key' => Str::random(20),
            'type' => $type, 'method' => $method, 'credit' => $credit, 'debit' => $debit, 'status' => $status,
            'created_at' => now(), 'updated_at' => now(), 'deleted_at' => $deleted ? now() : null,
        ]);

        // Paid in full in cash, deposit taken and handed back: received 10,000.
        $paid = $this->booking($car, 10000);
        $line($paid, 'booking_charge', null, 0, 10000);
        $line($paid, 'rental', 'cash', 10000, 0);
        $line($paid, 'security_deposit', 'cash', 5000, 0);
        $line($paid, 'security_deposit', 'cash', 0, 5000);

        // 2,000 of the deposit kept for damage: earnings 8,000 + 2,000, received 6,000 + 2,000.
        $damaged = $this->booking($car, 8000);
        $line($damaged, 'rental', 'cash', 6000, 0);
        $line($damaged, 'damage', null, 0, 2000);

        // A rejected transfer and a deleted payment don't count; an overpayment is capped at earnings.
        $messy = $this->booking($car, 5000, Booking::STATUS_ACTIVE);
        $line($messy, 'balance', 'bank', 3000, 0, Payment::STATUS_FAILED);
        $line($messy, 'rental', 'cash', 1000, 0, Payment::STATUS_SUCCEEDED, deleted: true);
        $line($messy, 'rental', 'cash', 6000, 0);

        $nothingYet = $this->booking($car, 4000, Booking::STATUS_CONFIRMED);
        $this->booking($car, 9999, Booking::STATUS_CANCELLED_BY_CUSTOMER, paid: 9999); // not going ahead — never counted

        // Another shop's booking must not leak into this shop's totals.
        VendorContext::forget();
        $theirs = Vehicle::withoutGlobalScopes()->create([
            'shop_id' => $this->otherShop->id, 'category_id' => $this->category->id, 'title' => 'Theirs',
            'slug' => 'theirs-' . Str::lower(Str::random(6)), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'XYZ-' . random_int(1000, 9999), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $this->booking($theirs, 50000, paid: 50000);

        $expected = [
            $paid->booking_reference => [10000, 10000],
            $damaged->booking_reference => [10000, 8000],
            $messy->booking_reference => [5000, 5000],
            $nothingYet->booking_reference => [4000, 0],
        ];

        // Per-row figures, in both the per-row shape (default sort) and the one-pass shape (sorted by an amount).
        foreach (['', '&sort_field=earnings_amount&sort_direction=desc'] as $sort) {
            $rows = collect($this->as($this->owner)->getJson("/api/vendor/earnings/bookings?perPage=50{$sort}")->assertOk()->json('record.data'))
                ->mapWithKeys(fn ($r) => [$r['booking_reference'] => [(float) $r['earnings_amount'], (float) $r['received_amount']]])
                ->all();
            $this->assertEquals($expected, $rows, "earnings rows {$sort}");
        }

        $summary = $this->as($this->owner)->getJson('/api/vendor/earnings')->assertOk()->json('data.summary');
        $this->assertSame(4, $summary['bookings_count']);
        $this->assertEquals(29000, (float) $summary['earnings_amount']);
        $this->assertEquals(23000, (float) $summary['received_amount']);
        $this->assertEquals(6000, (float) $summary['pending_amount']);

        $revenue = $this->as($this->owner)->getJson('/api/dashboard')->assertOk()->json('data.revenue');
        $this->assertEquals(['rental_income' => 29000, 'received' => 23000, 'still_due' => 6000], array_map('floatval', $revenue));

        // Outstanding lists only the two bookings still owing.
        $owing = collect($this->report('outstanding')->json('data.rows'))->pluck('due', 'reference')->map(fn ($v) => (float) $v)->all();
        $this->assertEquals([$damaged->booking_reference => 2000.0, $nothingYet->booking_reference => 4000.0], $owing);
    }

    public function test_profit_and_loss_adds_up_by_month_and_matches_earnings(): void
    {
        $car = $this->vehicle('Aqua');
        $this->booking($car, 30000);
        $this->booking($car, 99999, Booking::STATUS_CANCELLED_BY_CUSTOMER); // never income
        $this->expense(5000);
        $this->sale($this->vehicle('Sold Car', ['listing_type' => 'sale']), 2000000, 1900000);

        $response = $this->report('profit-loss');
        $this->assertSame('Mar 2026', $response->json('data.rows.0.month'));
        $this->assertEquals(30000, $response->json('data.rows.0.rental_income'));
        $this->assertEquals(1900000, $response->json('data.rows.0.vehicle_sales'));
        $this->assertEquals(5000, $response->json('data.rows.0.expenses'));
        $this->assertEquals(1925000, $response->json('data.rows.0.net'));

        $earnings = $this->as($this->owner)->getJson('/api/vendor/earnings?from=2026-01-01&to=2026-12-31')->assertOk()->json('data.summary.earnings_amount');
        $this->assertEquals($earnings, $response->json('data.summary.0.value'));
    }

    public function test_the_period_limits_what_counts(): void
    {
        $this->booking($this->vehicle('Aqua'), 30000);

        $rows = $this->as($this->owner)->getJson('/api/vendor/reports/profit-loss?from=2026-06-01&to=2026-06-30')->assertOk()->json('data.rows');
        $this->assertSame([], $rows);

        $this->as($this->owner)->getJson('/api/vendor/reports/profit-loss?from=2026-06-30&to=2026-06-01')->assertStatus(422);
    }

    public function test_vehicle_performance_ranks_by_net_with_linked_expenses(): void
    {
        $earner = $this->vehicle('Earner');
        $idle = $this->vehicle('Idle');
        $this->booking($earner, 30000);
        $this->expense(4000, $earner);
        $this->expense(1000, $idle);

        $rows = $this->report('vehicles')->json('data.rows');
        $this->assertSame(['Earner', 'Idle'], array_column($rows, 'vehicle'));
        $this->assertEquals(26000, $rows[0]['net']);
        $this->assertEquals(-1000, $rows[1]['net']);
    }

    public function test_a_car_that_moved_to_sale_keeps_its_rental_income_in_the_report(): void
    {
        $car = $this->vehicle('Moved', ['listing_type' => 'sale']);
        $this->booking($car, 30000);
        $this->vehicle('Sale Only', ['listing_type' => 'sale']);

        $this->assertSame(['Moved'], array_column($this->report('vehicles')->json('data.rows'), 'vehicle'));
    }

    public function test_the_sales_report_compares_price_and_leaves_out_the_nic(): void
    {
        $this->sale($this->vehicle('Sold Car', ['listing_type' => 'sale']), 2000000, 1900000);

        $response = $this->report('sales');
        $this->assertEquals(-100000, $response->json('data.rows.0.difference'));
        $this->assertEquals(100000, $response->json('data.summary.3.value'));
        $this->assertStringNotContainsString('901234567V', $response->getContent());
    }

    public function test_the_bookings_report_counts_every_status(): void
    {
        $car = $this->vehicle('Aqua');
        $this->booking($car, 30000);
        $this->booking($car, 20000, Booking::STATUS_PENDING);
        $this->booking($car, 10000, Booking::STATUS_REJECTED);

        $summary = $this->report('bookings')->json('data.summary');
        $this->assertSame(3, $summary[0]['value']);
        $this->assertSame(1, $summary[1]['value']);
        $this->assertSame(1, $summary[2]['value']);
        $this->assertEquals(30000, $summary[3]['value']);
    }

    public function test_outstanding_lists_only_money_still_due_whatever_the_period(): void
    {
        $car = $this->vehicle('Aqua');
        $this->booking($car, 30000, Booking::STATUS_COMPLETED, 10000);
        $this->booking($car, 20000, Booking::STATUS_COMPLETED, 20000); // settled
        $this->booking($car, 5000, Booking::STATUS_PENDING); // not going ahead yet

        $response = $this->as($this->owner)->getJson('/api/vendor/reports/outstanding?from=2030-01-01&to=2030-12-31')->assertOk();
        $this->assertCount(1, $response->json('data.rows'));
        $this->assertEquals(20000, $response->json('data.rows.0.due'));
        $this->assertSame('Amal Silva', $response->json('data.rows.0.customer'));
    }

    public function test_a_shop_sees_only_its_own_numbers(): void
    {
        $car = $this->vehicle('Aqua');
        $this->booking($car, 30000, Booking::STATUS_COMPLETED, 0);
        $this->expense(5000);
        $this->sale($this->vehicle('Sold', ['listing_type' => 'sale']), 2000000, 1900000);

        foreach (['profit-loss', 'vehicles', 'sales', 'bookings', 'outstanding'] as $name) {
            $this->assertSame([], $this->report($name, $this->otherOwner)->json('data.rows'), $name);
        }
    }

    public function test_reports_need_their_own_permission(): void
    {
        $staff = User::factory()->create(['shop_id' => $this->shop->id]);
        $role = Role::create(['name' => 'Bookkeeper', 'guard_name' => 'web', 'shop_id' => $this->shop->id]);
        $role->givePermissionTo('vendor-reports-bookings-view');
        $staff->setShopRole($role);

        $this->as($staff)->getJson('/api/vendor/reports/bookings')->assertOk();
        $this->as($staff)->getJson('/api/vendor/reports/profit-loss')->assertForbidden();
        $this->as($staff)->get('/api/vendor/reports/profit-loss/export?format=csv')->assertForbidden();
        $this->as($this->owner)->getJson('/api/vendor/reports/nonsense')->assertNotFound();
    }

    public function test_exports_download_and_defuse_formulas_in_names(): void
    {
        $this->customer->update(['name' => '=HYPERLINK("http://evil")']);
        $this->booking($this->vehicle('Aqua'), 30000);

        $csv = $this->as($this->owner)->get('/api/vendor/reports/bookings/export?format=csv&from=2026-01-01&to=2026-12-31')->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('Content-Type'));
        $this->assertStringContainsString("'=HYPERLINK", $csv->streamedContent());

        $pdf = $this->as($this->owner)->get('/api/vendor/reports/bookings/export?format=pdf&from=2026-01-01&to=2026-12-31')->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('Content-Type'));
    }
}
