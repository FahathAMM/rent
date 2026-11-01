<?php

namespace Tests\Feature;

use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The booking calendar's data: taken dates and the earliest pickup, for a public vehicle. */
class PublicVehicleAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();

        $shop = RentalShop::factory()->create(['status' => 'active', 'is_published' => true]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create(['vehicle_id' => $this->vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 24, 'min_rental_days' => 2, 'max_rental_days' => 10]);
    }

    private function day(int $offset): string
    {
        return now()->startOfDay()->addDays($offset)->toDateString();
    }

    public function test_lists_booked_blocked_and_maintenance_days_only(): void
    {
        foreach ([[3, VehicleAvailability::STATUS_BOOKED], [4, VehicleAvailability::STATUS_BLOCKED], [5, VehicleAvailability::STATUS_MAINTENANCE], [6, VehicleAvailability::STATUS_AVAILABLE], [-2, VehicleAvailability::STATUS_BOOKED]] as [$offset, $status]) {
            VehicleAvailability::create(['vehicle_id' => $this->vehicle->id, 'date' => $this->day($offset), 'status' => $status]);
        }

        $this->getJson("/api/public/vehicles/{$this->vehicle->slug}/availability")
            ->assertOk()
            ->assertJsonPath('data.unavailable_dates', [$this->day(3), $this->day(4), $this->day(5)])
            ->assertJsonPath('data.min_rental_days', 2)
            ->assertJsonPath('data.max_rental_days', 10);
    }

    public function test_earliest_pickup_respects_the_advance_notice_at_ten_am(): void
    {
        // 24h notice: at 09:00 tomorrow's 10:00 pickup is 25h away (ok); at 11:00 it's 23h away (too soon).
        Carbon::setTestNow(now()->startOfDay()->setTime(9, 0));
        $this->getJson("/api/public/vehicles/{$this->vehicle->slug}/availability")->assertJsonPath('data.earliest_pickup_date', $this->day(1));

        Carbon::setTestNow(now()->startOfDay()->setTime(11, 0));
        $this->getJson("/api/public/vehicles/{$this->vehicle->slug}/availability")->assertJsonPath('data.earliest_pickup_date', $this->day(2));

        Carbon::setTestNow();
    }

    public function test_unpublished_vehicles_are_not_found(): void
    {
        $this->vehicle->update(['status' => Vehicle::STATUS_DRAFT]);

        $this->getJson("/api/public/vehicles/{$this->vehicle->slug}/availability")->assertNotFound();
    }
}
