<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingDamage;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Payment;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SaleEnquiry;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehicleSaleDetail;
use App\Support\VendorContext;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The day-to-day vendor reports. Real bearer tokens, not actingAs(): see ShopBoundaryTest's docblock. */
class ShopActivityReportsTest extends TestCase
{
    use RefreshDatabase;

    private const ALL = ['payments', 'deposits', 'expenses', 'cancellations', 'schedule', 'damage', 'customers', 'enquiries', 'unsold', 'views', 'promotions', 'reviews', 'response'];

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

    private function report(string $name, ?User $user = null)
    {
        $this->app['auth']->forgetGuards();
        VendorContext::forget();

        return $this->withHeader('Authorization', 'Bearer ' . ($user ?? $this->owner)->createToken('test')->plainTextToken)
            ->getJson("/api/vendor/reports/{$name}?from=2026-01-01&to=2026-12-31")->assertOk();
    }

    private function vehicle(array $attributes = []): Vehicle
    {
        VendorContext::forget();

        return Vehicle::withoutGlobalScopes()->create($attributes + [
            'shop_id' => $this->shop->id, 'category_id' => $this->category->id, 'title' => 'Aqua',
            'slug' => 'car-' . Str::lower(Str::random(8)), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAB-' . random_int(1000, 9999), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function booking(Vehicle $vehicle, array $attributes = [], float $subtotal = 30000): Booking
    {
        $booking = Booking::withoutGlobalScopes()->create($attributes + [
            'booking_reference' => 'BKG-' . Str::upper(Str::random(8)), 'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id,
            'customer_id' => $this->customer->id, 'pickup_at' => '2026-03-10 10:00:00', 'return_at' => '2026-03-13 10:00:00',
            'rental_days' => 3, 'status' => Booking::STATUS_COMPLETED,
        ]);
        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => [], 'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => $subtotal, 'subtotal' => $subtotal, 'total_payable' => $subtotal,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', $booking->booking_reference),
        ]);

        return $booking;
    }

    private function payment(Booking $booking, string $method, float $credit, float $debit = 0, string $type = 'rental'): void
    {
        DB::table('payments')->insert([
            'booking_id' => $booking->id, 'payment_reference' => 'PAY-' . Str::random(8), 'idempotency_key' => Str::random(16),
            'type' => $type, 'method' => $method, 'credit' => $credit, 'debit' => $debit, 'status' => Payment::STATUS_SUCCEEDED,
            'paid_at' => '2026-03-11 09:00:00', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function saleCar(array $attributes = []): Vehicle
    {
        $vehicle = $this->vehicle($attributes + ['listing_type' => 'sale', 'published_at' => now()->subDays(40)]);
        VehicleSaleDetail::create(['vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'price' => 5000000, 'mileage_km' => 1000, 'condition' => 'used', 'sale_status' => 'available']);

        return $vehicle;
    }

    private function enquiry(Vehicle $vehicle, string $status = SaleEnquiry::STATUS_NEW): SaleEnquiry
    {
        VendorContext::forget();

        return SaleEnquiry::withoutGlobalScopes()->create([
            'reference' => 'ENQ-' . Str::upper(Str::random(6)), 'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id,
            'customer_id' => $this->customer->id, 'status' => $status,
        ]);
    }

    public function test_every_report_loads_on_an_empty_shop(): void
    {
        foreach (self::ALL as $name) {
            $data = $this->report($name)->json('data');
            $this->assertSame([], $data['rows'], $name);
            $this->assertNotEmpty($data['columns'], $name);
        }
    }

    public function test_no_shop_sees_another_shops_figures(): void
    {
        $car = $this->vehicle();
        $booking = $this->booking($car);
        $this->payment($booking, 'cash', 1000);
        SecurityDeposit::create(['booking_id' => $booking->id, 'amount_required' => 5000, 'amount_collected' => 5000, 'hold_method' => 'cash_on_pickup', 'status' => SecurityDeposit::STATUS_HELD]);
        BookingDamage::create(['booking_id' => $booking->id, 'area' => 'Bumper', 'description' => 'Scratch', 'severity' => 'minor', 'estimated_cost' => 100, 'charged_amount' => 100, 'status' => 'charged']);
        $this->booking($car, ['status' => Booking::STATUS_REJECTED]);
        $this->booking($car, ['status' => Booking::STATUS_CONFIRMED, 'pickup_at' => now()->addDay(), 'return_at' => now()->addDays(3)]);
        $this->enquiry($this->saleCar());
        Promotion::create(['reference_no' => 'PRM-1', 'shop_id' => $this->shop->id, 'type' => Promotion::TYPE_FEATURED, 'vehicle_id' => $car->id, 'days' => 7, 'amount' => 1000, 'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED, 'starts_at' => now(), 'ends_at' => now()->addDays(7), 'created_at' => '2026-03-01 00:00:00']);

        foreach (self::ALL as $name) {
            $this->assertSame([], $this->report($name, $this->otherOwner)->json('data.rows'), $name);
        }
        $this->assertNotEmpty($this->report('schedule')->json('data.rows'));
    }

    public function test_payments_split_cash_and_bank_and_count_money_going_back(): void
    {
        $booking = $this->booking($this->vehicle());
        $this->payment($booking, 'cash', 10000);
        $this->payment($booking, 'bank', 5000);
        $this->payment($booking, 'cash', 0, 2000, 'security_deposit');

        $summary = $this->report('payments')->json('data.summary');
        $this->assertEquals(15000, $summary[0]['value']);
        $this->assertEquals(2000, $summary[1]['value']);
        $this->assertEquals(8000, $summary[2]['value']);
        $this->assertEquals(5000, $summary[3]['value']);
    }

    public function test_deposits_show_what_is_held_returned_and_kept(): void
    {
        $car = $this->vehicle();
        SecurityDeposit::create(['booking_id' => $this->booking($car)->id, 'amount_required' => 5000, 'amount_collected' => 5000, 'hold_method' => 'cash_on_pickup', 'status' => SecurityDeposit::STATUS_HELD]);
        SecurityDeposit::create(['booking_id' => $this->booking($car)->id, 'amount_required' => 8000, 'amount_collected' => 8000, 'hold_method' => 'cash_on_pickup', 'status' => SecurityDeposit::STATUS_PARTIALLY_RELEASED, 'deductions_amount' => 3000, 'released_at' => now()]);

        $summary = $this->report('deposits')->json('data.summary');
        $this->assertEquals(13000, $summary[0]['value']);
        $this->assertEquals(5000, $summary[1]['value']);
        $this->assertEquals(5000, $summary[2]['value']);
        $this->assertEquals(3000, $summary[3]['value']);
    }

    public function test_expenses_name_the_biggest_category(): void
    {
        VendorContext::forget();
        foreach (['Fuel' => 1000, 'Repairs' => 9000] as $name => $total) {
            $category = ExpenseCategory::withoutGlobalScopes()->create(['shop_id' => $this->shop->id, 'name' => $name]);
            Expense::withoutGlobalScopes()->create(['shop_id' => $this->shop->id, 'expense_number' => 'EXP-' . Str::random(6), 'expense_category_id' => $category->id, 'expense_date' => '2026-03-15', 'subtotal' => $total, 'total' => $total]);
        }

        $summary = $this->report('expenses')->json('data.summary');
        $this->assertEquals(10000, $summary[0]['value']);
        $this->assertSame('Repairs', $summary[2]['value']);
    }

    public function test_cancellations_leave_out_bookings_that_went_ahead(): void
    {
        $car = $this->vehicle();
        $this->booking($car);
        $this->booking($car, ['status' => Booking::STATUS_NO_SHOW], 7000);
        $this->booking($car, ['status' => Booking::STATUS_CANCELLED_BY_CUSTOMER, 'cancellation_reason' => 'Plans changed'], 3000);

        $data = $this->report('cancellations')->json('data');
        $this->assertCount(2, $data['rows']);
        $this->assertEquals(10000, $data['summary'][1]['value']);
        $this->assertSame(1, $data['summary'][2]['value']);
        $this->assertContains('Plans changed', array_column($data['rows'], 'reason'));
    }

    public function test_the_schedule_covers_the_next_week_only(): void
    {
        $car = $this->vehicle();
        $this->booking($car, ['status' => Booking::STATUS_CONFIRMED, 'pickup_at' => now()->addDays(2), 'return_at' => now()->addDays(4)]);
        $this->booking($car, ['status' => Booking::STATUS_ACTIVE, 'pickup_at' => now()->subDay(), 'return_at' => now()->addDay()]);
        $this->booking($car, ['status' => Booking::STATUS_CONFIRMED, 'pickup_at' => now()->addDays(30), 'return_at' => now()->addDays(33)]);

        $data = $this->report('schedule')->json('data');
        $this->assertSame(['Return', 'Pickup'], array_column($data['rows'], 'kind'));
        $this->assertFalse($data['dated']);
    }

    public function test_damage_shows_what_was_not_recovered(): void
    {
        $booking = $this->booking($this->vehicle());
        BookingDamage::create(['booking_id' => $booking->id, 'area' => 'Bumper', 'description' => 'Scratch', 'severity' => 'minor', 'estimated_cost' => 5000, 'charged_amount' => 3000, 'status' => 'charged', 'created_at' => '2026-03-14 10:00:00']);

        $this->assertEquals(2000, $this->report('damage')->json('data.summary.3.value'));
    }

    public function test_customers_rank_by_spend_and_count_repeats(): void
    {
        $car = $this->vehicle();
        $this->booking($car);
        $this->booking($car);
        $other = Customer::factory()->create(['name' => 'Once Only']);
        $this->booking($car, ['customer_id' => $other->id], 1000);

        $data = $this->report('customers')->json('data');
        $this->assertSame(['Amal Silva', 'Once Only'], array_column($data['rows'], 'customer'));
        $this->assertSame(1, $data['summary'][1]['value']);
    }

    public function test_enquiry_conversion_counts_the_sale(): void
    {
        $car = $this->saleCar();
        $this->enquiry($car, SaleEnquiry::STATUS_ACCEPTED);
        $this->enquiry($car, SaleEnquiry::STATUS_CLOSED);

        // Enquiries are stamped now, so ask about today.
        $this->app['auth']->forgetGuards();
        VendorContext::forget();
        $data = $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('test')->plainTextToken)
            ->getJson('/api/vendor/reports/enquiries')->assertOk()->json('data');

        $this->assertEquals(50, $data['summary'][3]['value']);
    }

    public function test_unsold_stock_puts_the_slowest_car_first(): void
    {
        $this->saleCar(['title' => 'Slow', 'published_at' => now()->subDays(90)]);
        $this->saleCar(['title' => 'New', 'published_at' => now()->subDays(2)]);
        $this->vehicle(['title' => 'Rental']);

        $data = $this->report('unsold')->json('data');
        $this->assertSame(['Slow', 'New'], array_column($data['rows'], 'vehicle'));
        $this->assertSame(2, $data['summary'][3]['value']);
    }

    public function test_listing_views_cover_rentals_and_sales(): void
    {
        $this->vehicle(['title' => 'Rental']);
        DB::table('vehicles')->where('title', 'Rental')->update(['view_count' => 100, 'booking_count' => 5]);
        $this->saleCar(['title' => 'For Sale']);

        $rows = $this->report('views')->json('data.rows');
        $this->assertSame(['Rental', 'For Sale'], array_column($rows, 'vehicle'));
        $this->assertEquals(5, $rows[0]['conversion']);
        $this->assertSame('For sale', $rows[1]['type']);
    }

    public function test_promotions_only_count_approved_spend(): void
    {
        $car = $this->vehicle();
        foreach ([Promotion::STATUS_APPROVED => 3000, Promotion::STATUS_REJECTED => 1000] as $status => $amount) {
            Promotion::create(['reference_no' => 'PRM-' . $status, 'shop_id' => $this->shop->id, 'type' => Promotion::TYPE_FEATURED, 'vehicle_id' => $car->id, 'days' => 7, 'amount' => $amount, 'kind' => Promotion::KIND_GRANTED, 'status' => $status, 'starts_at' => now(), 'ends_at' => now()->addDays(7)]);
        }
        DB::table('promotions')->update(['created_at' => '2026-03-01 00:00:00']);

        $this->assertEquals(3000, $this->report('promotions')->json('data.summary.1.value'));
    }

    public function test_reviews_put_the_lowest_rating_first_and_skip_unpublished(): void
    {
        $car = $this->vehicle();
        foreach ([[5, Review::STATUS_PUBLISHED], [2, Review::STATUS_PUBLISHED], [1, Review::STATUS_PENDING]] as [$rating, $status]) {
            Review::create(['booking_id' => $this->booking($car)->id, 'vehicle_id' => $car->id, 'shop_id' => $this->shop->id, 'user_id' => $this->customer->id, 'rating' => $rating, 'status' => $status, 'is_verified_booking' => true]);
        }
        DB::table('reviews')->update(['created_at' => '2026-03-01 00:00:00']);

        $data = $this->report('reviews')->json('data');
        $this->assertSame([2, 5], array_column($data['rows'], 'rating'));
        $this->assertEquals(3.5, $data['summary'][1]['value']);
        $this->assertSame(1, $data['summary'][2]['value']);
    }

    public function test_response_time_averages_hours_to_decide(): void
    {
        $booking = $this->booking($this->vehicle(), ['accepted_at' => '2026-03-01 14:00:00']);
        DB::table('bookings')->where('id', $booking->id)->update(['created_at' => '2026-03-01 10:00:00']);

        $this->assertEquals(4, $this->report('response')->json('data.summary.1.value'));
    }
}
