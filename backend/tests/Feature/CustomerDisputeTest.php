<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerDisputeTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;
    private Customer $otherCustomer;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'title' => 'Dispute Test Car',
            'slug' => 'dispute-test-' . Str::lower(Str::random(6)),
            'make' => 'Toyota',
            'model' => 'Aqua',
            'year' => 2020,
            'registration_number' => 'DSP-' . Str::upper(Str::random(6)),
            'transmission' => 'automatic',
            'fuel_type' => 'hybrid',
            'seating_capacity' => 5,
            'status' => Vehicle::STATUS_PUBLISHED,
            'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->customer = Customer::factory()->create();
        $this->otherCustomer = Customer::factory()->create();
        $this->booking = Booking::create([
            'booking_reference' => 'BKG-DSP-' . Str::upper(Str::random(6)),
            'vehicle_id' => $vehicle->id,
            'shop_id' => $shop->id,
            'customer_id' => $this->customer->id,
            'pickup_at' => now()->addDays(5),
            'return_at' => now()->addDays(8),
            'rental_days' => 3,
            'status' => Booking::STATUS_CONFIRMED,
        ]);
    }

    private function asCustomer(Customer $customer)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $customer->createToken('test')->plainTextToken);
    }

    public function test_customer_can_open_view_and_reply_to_a_dispute_on_their_booking(): void
    {
        $created = $this->asCustomer($this->customer)->postJson('/api/customer/disputes', [
            'booking_reference' => $this->booking->booking_reference,
            'against_side' => 'owner',
            'category' => 'overcharge',
            'subject' => 'Unexpected charge',
            'description' => 'The final charge was higher than the agreed quote.',
            'claimed_amount' => 2500,
        ])->assertCreated()
            ->assertJsonPath('data.raised_by_side', 'customer')
            ->assertJsonPath('data.raised_by_customer_id', $this->customer->id);

        $reference = $created->json('data.dispute_reference');
        $this->assertDatabaseHas('audit_logs', ['form' => 'Dispute', 'customer_id' => $this->customer->id]);

        $this->asCustomer($this->customer)->getJson('/api/customer/disputes')->assertOk()
            ->assertJsonPath('record.data.0.dispute_reference', $reference);

        $this->asCustomer($this->customer)->getJson("/api/customer/disputes/{$reference}")->assertOk()
            ->assertJsonPath('data.booking.booking_reference', $this->booking->booking_reference)
            ->assertJsonMissingPath('data.booking.internal_note');

        $this->asCustomer($this->customer)->postJson("/api/customer/disputes/{$reference}/messages", [
            'message' => 'I have attached the original quote details.',
        ])->assertCreated()->assertJsonPath('data.author_type', 'customer');

        $this->asCustomer($this->customer)->getJson("/api/customer/disputes/{$reference}")->assertOk()
            ->assertJsonPath('data.messages.0.message', 'I have attached the original quote details.');
    }

    public function test_customer_cannot_open_a_dispute_for_another_customers_booking(): void
    {
        $this->asCustomer($this->otherCustomer)->postJson('/api/customer/disputes', [
            'booking_reference' => $this->booking->booking_reference,
            'against_side' => 'owner',
            'category' => 'other',
            'subject' => 'Not my rental',
            'description' => 'This should be rejected.',
        ])->assertNotFound();

        $this->assertDatabaseCount('disputes', 0);
    }

    public function test_customer_cannot_read_or_reply_to_another_customers_dispute(): void
    {
        $dispute = Dispute::create([
            'dispute_reference' => 'DSP-' . Str::upper(Str::random(10)),
            'booking_id' => $this->booking->id,
            'raised_by_customer_id' => $this->customer->id,
            'raised_by_side' => 'customer',
            'against_side' => 'owner',
            'category' => 'other',
            'subject' => 'Private dispute',
            'description' => 'Private details.',
        ]);

        $this->asCustomer($this->otherCustomer)->getJson("/api/customer/disputes/{$dispute->dispute_reference}")->assertNotFound();
        $this->asCustomer($this->otherCustomer)->postJson("/api/customer/disputes/{$dispute->dispute_reference}/messages", [
            'message' => 'Unauthorized reply',
        ])->assertNotFound();
    }
}
