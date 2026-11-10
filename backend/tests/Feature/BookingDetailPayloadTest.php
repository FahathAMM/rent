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
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The platform and vendor booking detail pages share one component, so both payloads carry the same keys. */
class BookingDetailPayloadTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $shop->id]);
        $this->owner->setShopRole(User::SHOP_ROLE_OWNER);

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->booking = Booking::create([
            'booking_reference' => 'BKG-DETAIL-001', 'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id,
            'customer_id' => Customer::factory()->create()->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3,
            'status' => Booking::STATUS_PENDING, 'customer_note' => 'Arriving by flight',
        ]);
        BookingPricing::create([
            'booking_id' => $this->booking->id, 'currency' => 'LKR',
            'pricing_snapshot' => ['security_deposit' => 0, 'deposit_method' => 'cash_on_pickup'],
            'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => 21000, 'subtotal' => 21000, 'total_payable' => 21000,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'BKG-DETAIL-001'),
        ]);
    }

    public function test_platform_booking_detail_has_the_rich_payload(): void
    {
        $admin = SystemAdmin::factory()->create();

        $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)
            ->getJson('/api/platform/bookings/BKG-DETAIL-001')
            ->assertOk()
            ->assertJsonPath('data.vehicle.title', 'Toyota Aqua 2020')
            ->assertJsonPath('data.pricing.base_amount', '21000.00')
            ->assertJsonStructure(['data' => ['shop', 'customer', 'status_histories', 'inspections', 'damages', 'payments', 'disputes']]);
    }

    public function test_vendor_booking_detail_has_the_same_keys(): void
    {
        $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('v')->plainTextToken)
            ->getJson('/api/vendor/bookings/BKG-DETAIL-001')
            ->assertOk()
            ->assertJsonPath('data.vehicle.make', 'Toyota')
            ->assertJsonPath('data.pricing.base_amount', '21000.00')
            ->assertJsonPath('data.pricing.breakdown.base_amount', 21000)
            ->assertJsonPath('data.pricing.breakdown.rate_plan', 'daily')
            ->assertJsonPath('data.customer_note', 'Arriving by flight')
            ->assertJsonStructure(['data' => ['vehicle' => ['images'], 'customer', 'status_histories', 'inspections', 'damages', 'payments']]);
    }

    public function test_the_vendor_list_stays_lean(): void
    {
        $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('v')->plainTextToken)
            ->getJson('/api/vendor/bookings')
            ->assertOk()
            ->assertJsonMissingPath('record.data.0.inspections')
            ->assertJsonMissingPath('record.data.0.status_histories');
    }
}
