<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehicleInquiry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 8 — guard-rail tests for the two features added when Phase 7's
 * remaining scope was closed out that introduce real cross-party
 * authorization surface: Dispute (reachable by either side of a booking,
 * resolved via CustomerDisputeQuery rather than a shop-scoped lookup) and
 * VehicleInquiry (deliberately not BelongsToShop, so the vendor side
 * checks shop_id explicitly). Follows ShopBoundaryTest's convention: real
 * bearer tokens, never actingAs().
 */
class DisputeAndInquiryBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shopA;
    private RentalShop $shopB;
    private User $ownerA;
    private User $ownerB;
    private Customer $customerA;
    private User $strangerUser;
    private Booking $bookingA;

    protected function setUp(): void
    {
        parent::setUp();

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);

        $this->ownerA = User::factory()->create();
        $this->ownerB = User::factory()->create();
        $this->customerA = Customer::factory()->create();
        $this->strangerUser = User::factory()->create();

        $this->shopA = RentalShop::factory()->create(['owner_user_id' => $this->ownerA->id]);
        $this->shopB = RentalShop::factory()->create(['owner_user_id' => $this->ownerB->id]);
        ShopMember::create(['shop_id' => $this->shopA->id, 'user_id' => $this->ownerA->id, 'role' => 'owner', 'status' => 'active']);
        ShopMember::create(['shop_id' => $this->shopB->id, 'user_id' => $this->ownerB->id, 'role' => 'owner', 'status' => 'active']);

        $vehicleA = Vehicle::create([
            'shop_id' => $this->shopA->id, 'category_id' => $category->id, 'title' => 'Shop A Car',
            'slug' => 'shop-a-car-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'AAA-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $this->bookingA = Booking::create([
            'booking_reference' => 'BKG-BOUND-001',
            'vehicle_id' => $vehicleA->id, 'shop_id' => $this->shopA->id, 'customer_id' => $this->customerA->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3,
            'status' => Booking::STATUS_CONFIRMED,
        ]);
    }

    private function as(User $user)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken);
    }

    public function test_an_account_that_is_not_party_to_a_booking_cannot_raise_a_dispute_on_it(): void
    {
        $this->as($this->strangerUser)
            ->postJson('/api/disputes', [
                'booking_reference' => $this->bookingA->booking_reference,
                'against_side' => 'owner',
                'category' => 'damage',
                'subject' => 'Not my booking',
                'description' => 'Trying to dispute someone else\'s booking.',
            ])
            ->assertForbidden();
    }

    /**
     * bookings.customer_id is a customers.id; this route authenticates
     * users. A vendor account whose users.id happens to equal the
     * booking's customer id must not be treated as that customer.
     */
    public function test_a_vendor_whose_user_id_collides_with_the_bookings_customer_id_is_not_treated_as_the_customer(): void
    {
        $collidingId = max(Customer::max('id'), User::max('id')) + 1;
        $customer = Customer::factory()->create(['id' => $collidingId]);
        $this->bookingA->update(['customer_id' => $customer->id]);
        $collider = User::factory()->create(['id' => $collidingId]);

        $this->as($collider)
            ->postJson('/api/disputes', [
                'booking_reference' => $this->bookingA->booking_reference,
                'against_side' => 'owner',
                'category' => 'damage',
                'subject' => 'Disputed damage charge',
                'description' => 'The charge does not match what was agreed.',
            ])
            ->assertForbidden();
    }

    public function test_the_bookings_shop_owner_can_also_raise_a_dispute_through_the_same_route(): void
    {
        $this->as($this->ownerA)
            ->postJson('/api/disputes', [
                'booking_reference' => $this->bookingA->booking_reference,
                'against_side' => 'customer',
                'category' => 'no_show',
                'subject' => 'Customer never arrived',
                'description' => 'Pickup window passed with no contact.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.raised_by_side', 'owner');
    }

    public function test_a_shop_owner_from_an_unrelated_shop_cannot_view_the_dispute(): void
    {
        $dispute = Dispute::create([
            'dispute_reference' => 'DSP-BOUND-001', 'booking_id' => $this->bookingA->id,
            'raised_by_user_id' => $this->ownerA->id, 'raised_by_side' => 'owner', 'against_side' => 'customer',
            'category' => 'damage', 'subject' => 'Test dispute', 'description' => 'Test.',
            'status' => Dispute::STATUS_OPEN, 'priority' => 'normal',
        ]);

        $this->as($this->ownerB)
            ->getJson("/api/disputes/{$dispute->dispute_reference}")
            ->assertNotFound();
    }

    public function test_a_stranger_cannot_message_a_dispute_they_are_not_party_to(): void
    {
        $dispute = Dispute::create([
            'dispute_reference' => 'DSP-BOUND-002', 'booking_id' => $this->bookingA->id,
            'raised_by_user_id' => $this->ownerA->id, 'raised_by_side' => 'owner', 'against_side' => 'customer',
            'category' => 'damage', 'subject' => 'Test dispute', 'description' => 'Test.',
            'status' => Dispute::STATUS_OPEN, 'priority' => 'normal',
        ]);

        $this->as($this->strangerUser)
            ->postJson("/api/disputes/{$dispute->dispute_reference}/messages", ['message' => 'Butting in'])
            ->assertNotFound();
    }

    public function test_a_shop_cannot_reply_to_another_shops_vehicle_inquiry(): void
    {
        $vehicleB = Vehicle::create([
            'shop_id' => $this->shopB->id, 'category_id' => VehicleCategory::first()->id, 'title' => 'Shop B Car',
            'slug' => 'shop-b-car-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Premio', 'year' => 2021,
            'registration_number' => 'BBB-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'petrol',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $inquiry = VehicleInquiry::create([
            'vehicle_id' => $vehicleB->id, 'shop_id' => $this->shopB->id, 'name' => 'Prospective Renter',
            'message' => 'Is this available?', 'status' => VehicleInquiry::STATUS_NEW,
        ]);

        $this->as($this->ownerA)
            ->withHeader('X-Shop-Id', (string) $this->shopA->id)
            ->postJson("/api/vendor/inquiries/{$inquiry->id}/reply", ['reply_message' => 'Trying to reply cross-shop'])
            ->assertNotFound();
    }
}
