<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\OwnerBankDetail;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehicleInquiry;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * The vendor menu's shape, and the pages behind it: their permissions are
 * enforced by the API, not only by hiding the menu item, and their searches
 * never leave the shop.
 */
class VendorMenuAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $otherOwner;
    private RentalShop $shop;
    private RentalShop $otherShop;
    private Vehicle $vehicle;
    private Vehicle $otherVehicle;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->customer = Customer::factory()->create();

        [$this->owner, $this->shop] = $this->makeShop();
        [$this->otherOwner, $this->otherShop] = $this->makeShop();
        $this->vehicle = $this->makeVehicle($this->shop, $category, 'Own Aqua');
        $this->otherVehicle = $this->makeVehicle($this->otherShop, $category, 'Other Aqua');
    }

    private function makeShop(): array
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole('owner');

        return [$owner, $shop];
    }

    private function makeVehicle(RentalShop $shop, VehicleCategory $category, string $title): Vehicle
    {
        return Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'AAA-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function makeBooking(Vehicle $vehicle, string $reference, string $status = Booking::STATUS_CONFIRMED): Booking
    {
        return Booking::create([
            'booking_reference' => $reference,
            'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'customer_id' => $this->customer->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3,
            'status' => $status,
        ]);
    }

    private function makeInquiry(Vehicle $vehicle, string $name): VehicleInquiry
    {
        return VehicleInquiry::create([
            'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'name' => $name, 'phone' => '0771234567',
            'email' => Str::slug($name) . '@example.com', 'message' => 'Is this available?', 'status' => VehicleInquiry::STATUS_NEW,
        ]);
    }

    private function makeReview(Vehicle $vehicle, string $comment, string $reference): Review
    {
        return Review::create([
            'booking_id' => $this->makeBooking($vehicle, $reference, Booking::STATUS_COMPLETED)->id,
            'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'user_id' => $this->customer->id,
            'rating' => 5, 'comment' => $comment, 'status' => Review::STATUS_PUBLISHED,
        ]);
    }

    private function staff(array $permissions): User
    {
        return User::factory()->memberOf($this->shop, ['vendor-dashboard-view', ...$permissions])->create();
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    public function test_inquiry_search_stays_within_the_shop(): void
    {
        $this->makeInquiry($this->vehicle, 'Sam Own');
        $this->makeInquiry($this->otherVehicle, 'Sam Other');

        foreach (['Sam', '@example.com', 'Aqua'] as $term) {
            $rows = $this->as($this->owner)->getJson('/api/vendor/inquiries?search=' . urlencode($term))->assertOk()->json('record.data');

            $this->assertSame(['Sam Own'], array_column($rows, 'name'), "searching \"{$term}\"");
        }
    }

    public function test_review_search_stays_within_the_shop_and_published_reviews(): void
    {
        $this->makeReview($this->vehicle, 'Great car', 'BKG-REV-001');
        $this->makeReview($this->otherVehicle, 'Great drive', 'BKG-REV-002');
        $this->makeReview($this->vehicle, 'Great but hidden', 'BKG-REV-003')->update(['status' => Review::STATUS_PENDING]);

        foreach (['Great', 'Aqua'] as $term) {
            $rows = $this->as($this->owner)->getJson('/api/vendor/reviews?search=' . urlencode($term))->assertOk()->json('record.data');

            $this->assertSame(['Great car'], array_column($rows, 'comment'), "searching \"{$term}\"");
        }
    }

    public function test_bank_detail_search_stays_within_the_shop(): void
    {
        foreach ([$this->shop, $this->otherShop] as $shop) {
            OwnerBankDetail::create([
                'shop_id' => $shop->id, 'account_holder_name' => "Holder {$shop->id}", 'bank_name' => 'Peoples Bank',
                'account_number' => '1234567890', 'account_number_last4' => '7890',
            ]);
        }

        foreach (['Peoples', 'Holder'] as $term) {
            $rows = $this->as($this->owner)->getJson('/api/vendor/bank-details?search=' . urlencode($term))->assertOk()->json('record.data');

            $this->assertSame(["Holder {$this->shop->id}"], array_column($rows, 'account_holder_name'), "searching \"{$term}\"");
        }
    }

    public function test_booking_search_keeps_the_status_filter(): void
    {
        $this->makeBooking($this->vehicle, 'BKG-KEEP-001', Booking::STATUS_CONFIRMED);
        $this->makeBooking($this->vehicle, 'BKG-DROP-002', Booking::STATUS_REJECTED);

        $rows = $this->as($this->owner)
            ->getJson('/api/vendor/bookings?status=' . Booking::STATUS_CONFIRMED . '&search=' . urlencode($this->customer->name))
            ->assertOk()->json('record.data');

        $this->assertSame(['BKG-KEEP-001'], array_column($rows, 'booking_reference'));
    }

    public function test_inquiries_need_their_permissions(): void
    {
        $inquiry = $this->makeInquiry($this->vehicle, 'Sam Own');
        $reply = ['reply_message' => 'Yes, it is.'];

        $none = $this->staff([]);
        $this->as($none)->getJson('/api/vendor/inquiries')->assertForbidden();
        $this->as($none)->postJson("/api/vendor/inquiries/{$inquiry->id}/reply", $reply)->assertForbidden();

        $viewer = $this->staff(['vendor-vehicles-inquiries-view']);
        $this->as($viewer)->getJson('/api/vendor/inquiries')->assertOk();
        $this->as($viewer)->postJson("/api/vendor/inquiries/{$inquiry->id}/reply", $reply)->assertForbidden();

        $editor = $this->staff(['vendor-vehicles-inquiries-edit']);
        $this->as($editor)->postJson("/api/vendor/inquiries/{$inquiry->id}/reply", $reply)->assertOk();
    }

    public function test_reviews_need_their_permissions(): void
    {
        $review = $this->makeReview($this->vehicle, 'Great car', 'BKG-REV-010');
        $reply = ['reply' => 'Thank you!'];

        $none = $this->staff([]);
        $this->as($none)->getJson('/api/vendor/reviews')->assertForbidden();
        $this->as($none)->postJson("/api/vendor/reviews/{$review->id}/reply", $reply)->assertForbidden();

        $viewer = $this->staff(['vendor-vehicles-reviews-view']);
        $this->as($viewer)->getJson('/api/vendor/reviews')->assertOk();
        $this->as($viewer)->postJson("/api/vendor/reviews/{$review->id}/reply", $reply)->assertForbidden();

        $editor = $this->staff(['vendor-vehicles-reviews-edit']);
        $this->as($editor)->postJson("/api/vendor/reviews/{$review->id}/reply", $reply)->assertOk();
    }

    public function test_another_shops_review_stays_not_found_for_a_reply(): void
    {
        $review = $this->makeReview($this->otherVehicle, 'Great drive', 'BKG-REV-011');

        $this->as($this->owner)->postJson("/api/vendor/reviews/{$review->id}/reply", ['reply' => 'Hijack'])->assertNotFound();
    }

    public function test_audit_logs_are_for_the_shop_owner_only(): void
    {
        $this->as($this->staff(['vendor-vehicles-list-view']))->getJson('/api/audit-logs')->assertForbidden();
        $this->as($this->owner)->getJson('/api/audit-logs')->assertOk();
    }

    public function test_the_menu_layout_keeps_the_existing_permissions(): void
    {
        $tree = collect($this->as($this->owner)->getJson('/api/menus/navigation?audience=vendor')->assertOk()->json('data'));

        $this->assertSame(
            ['Dashboard', 'Rental', 'Vehicle', 'Sales', 'Finance', 'Expenses', 'Reports', 'Settings'],
            $tree->pluck('name')->all(),
        );

        $names = fn (string $section) => collect($tree->firstWhere('name', $section)['children'])->pluck('name')->all();
        $this->assertSame(['My Vehicles', 'Calendar', 'Bookings', 'Reviews', 'Inquiries'], $names('Rental'));
        $this->assertSame(['Promotions', 'Categories'], $names('Vehicle'));
        $this->assertSame(['My Vehicles', 'Enquiries', 'Sold', 'Sale Terms'], $names('Sales'));
        $this->assertSame(['Earnings', 'Bank Details'], $names('Finance'));
        $this->assertSame(['Expenses', 'Categories'], $names('Expenses'));
        $this->assertSame([
            'Profit & Loss', 'Vehicle Performance', 'Vehicle Sales', 'Bookings', 'Outstanding Balances',
            'Payments Received', 'Security Deposits', 'Expenses', 'Cancellations', 'Upcoming Schedule', 'Damage', 'Customers',
            'Enquiry Conversion', 'Unsold Stock', 'Listing Views', 'Promotions', 'Reviews', 'Response Time',
        ], $names('Reports'));
        $this->assertSame(['Shop Profile', 'Locations', 'Terms & Conditions', 'Staff', 'Roles & Permissions', 'Subscription'], $names('Settings'));

        $staff = $this->staff(['vendor-vehicles-bookings-view']);
        $this->assertContains('/vendor/bookings', $this->routesFor($staff));
        $this->assertNotContains('/vendor/reviews', $this->routesFor($staff));
    }

    public function test_pages_only_get_the_permissions_they_use(): void
    {
        $names = Permission::pluck('name');

        foreach (['vendor-dashboard-delete', 'vendor-finance-earnings-create', 'vendor-vehicles-categories-edit'] as $unused) {
            $this->assertNotContains($unused, $names);
        }
        foreach (['vendor-dashboard-view', 'vendor-promotions-view', 'vendor-vehicles-categories-view', 'vendor-vehicles-list-delete', 'vendor-vehicles-bookings-edit', 'vendor-expense-expenses-create', 'vendor-subscription-create', 'customer-favorites-delete'] as $kept) {
            $this->assertContains($kept, $names);
        }
    }

    private function routesFor(User $user): array
    {
        return collect($this->as($user)->getJson('/api/menus/navigation?audience=vendor')->assertOk()->json('data'))
            ->flatMap(fn ($item) => [$item['route_name'] ?? null, ...array_column($item['children'] ?? [], 'route_name')])
            ->filter()->values()->all();
    }
}
