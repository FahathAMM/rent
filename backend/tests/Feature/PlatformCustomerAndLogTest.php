<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Platform admin's customer management works on the `customers` table, and the log viewer can download. */
class PlatformCustomerAndLogTest extends TestCase
{
    use RefreshDatabase;

    private function admin()
    {
        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}")->withHeader('Accept', 'application/json');
    }

    public function test_customer_list_shows_customers_not_vendor_users(): void
    {
        $customer = Customer::factory()->create(['name' => 'Nimal Customer']);
        User::factory()->create(['name' => 'Vendor Person']);

        $this->admin()->getJson('/api/platform/customers')
            ->assertOk()
            ->assertJsonPath('record.total', 1)
            ->assertJsonPath('record.data.0.id', $customer->id)
            ->assertJsonPath('record.data.0.bookings_count', 0);
    }

    public function test_customer_list_filters_by_search_and_status(): void
    {
        Customer::factory()->create(['name' => 'Kasun Perera']);
        Customer::factory()->create(['name' => 'Other Person', 'status' => Customer::STATUS_BANNED]);

        $this->admin()->getJson('/api/platform/customers?search=kasun')->assertJsonPath('record.total', 1);
        $this->admin()->getJson('/api/platform/customers?status=banned')->assertJsonPath('record.data.0.name', 'Other Person');
    }

    public function test_customer_detail_loads(): void
    {
        $customer = Customer::factory()->create();

        $this->admin()->getJson("/api/platform/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id)
            ->assertJsonPath('data.bookings_count', 0);
    }

    public function test_customer_detail_has_stats_bookings_and_disputes(): void
    {
        $customer = Customer::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => User::factory()->create()->id, 'name' => 'Lanka Rides']);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        foreach ([['BKG-1', Booking::STATUS_COMPLETED, 21000], ['BKG-2', Booking::STATUS_PENDING, 9000]] as [$ref, $status, $total]) {
            $booking = Booking::create([
                'booking_reference' => $ref, 'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id, 'customer_id' => $customer->id,
                'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3, 'status' => $status,
            ]);
            BookingPricing::create([
                'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => [], 'rate_plan' => 'daily', 'rate_breakdown' => [],
                'base_amount' => $total, 'subtotal' => $total, 'total_payable' => $total,
                'computed_at' => now(), 'snapshot_hash' => hash('sha256', $ref),
            ]);
        }

        $this->admin()->getJson("/api/platform/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.bookings_count', 2)
            ->assertJsonPath('data.stats.completed', 1)
            ->assertJsonPath('data.stats.upcoming', 1)
            ->assertJsonPath('data.stats.shops_used', 1)
            ->assertJsonPath('data.stats.total_spent', 21000)
            ->assertJsonPath('data.bookings.0.vehicle.title', 'Toyota Aqua 2020')
            ->assertJsonPath('data.bookings.0.shop.name', 'Lanka Rides')
            ->assertJsonCount(0, 'data.disputes');
    }

    public function test_suspending_a_customer_revokes_their_tokens_and_activate_restores(): void
    {
        $customer = Customer::factory()->create();
        $customer->createToken('session');

        $this->admin()->postJson("/api/platform/customers/{$customer->id}/suspend", ['reason' => 'Fraud check'])
            ->assertOk()
            ->assertJsonPath('data.status', Customer::STATUS_SUSPENDED);
        $this->assertSame(0, $customer->tokens()->count());

        $this->admin()->postJson("/api/platform/customers/{$customer->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', Customer::STATUS_ACTIVE);
    }

    public function test_log_file_downloads(): void
    {
        $name = 'test-download-' . uniqid() . '.log';
        File::put(storage_path("logs/{$name}"), "[2026-10-30 10:00:00] testing.INFO: hello\n");

        try {
            $this->admin()->get("/api/platform/logs/download?file={$name}")
                ->assertOk()
                ->assertDownload($name);
        } finally {
            File::delete(storage_path("logs/{$name}"));
        }
    }

    public function test_sms_logs_are_listed_and_readable_in_the_log_viewer(): void
    {
        $name = 'sms-test-' . uniqid() . '.log';
        File::ensureDirectoryExists(storage_path('logs/sms'));
        File::put(
            storage_path("logs/sms/{$name}"),
            "[2026-11-12 13:05:10] local.INFO: [sent] to 94771234567: LankaLane verification code: 123456.\n"
            . "[2026-11-12 13:06:02] local.ERROR: [failed] to 94771234567: hello {\"error\":\"Insufficient balance\"}\n"
        );

        try {
            $this->admin()->getJson('/api/platform/logs')
                ->assertOk()
                ->assertJsonFragment(['name' => "sms/{$name}"]);

            $this->admin()->getJson("/api/platform/logs/entries?file=sms/{$name}")
                ->assertOk()
                ->assertJsonFragment(['level' => 'INFO'])
                ->assertJsonFragment(['level' => 'ERROR']);

            $this->admin()->get("/api/platform/logs/download?file=sms/{$name}")->assertOk()->assertDownload($name);

            // Only the known folders are readable — no walking out of storage/logs.
            $this->admin()->getJson('/api/platform/logs/entries?file=../.env')->assertNotFound();
            $this->admin()->getJson('/api/platform/logs/entries?file=other/x.log')->assertNotFound();
        } finally {
            File::delete(storage_path("logs/sms/{$name}"));
        }
    }

    public function test_missing_log_file_is_a_404(): void
    {
        $this->admin()->getJson('/api/platform/logs/download?file=does-not-exist.log')->assertNotFound();
    }
}
