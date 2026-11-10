<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Role;
use App\Models\SaleEnquiry;
use App\Models\ShopSettings;
use App\Models\ShopSubscription;
use App\Models\SubscriptionPlan;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleModel;
use App\Models\VehiclePricing;
use App\Models\VehicleSale;
use App\Models\VehicleSaleDetail;
use App\Support\VendorContext;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Vehicle sales, phase 1 — app-doc/marketplace/13-vehicle-sales.md. Real
 * bearer tokens, not actingAs(): see ShopBoundaryTest's docblock for why.
 */
class VehicleSalesTest extends TestCase
{
    use RefreshDatabase;

    /** A 1×1 PNG. */
    private const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private User $owner;
    private RentalShop $shop;
    private User $otherOwner;
    private RentalShop $otherShop;
    private Customer $buyer;
    private Customer $otherBuyer;
    private VehicleCategory $category;
    private VehicleBrand $brand;
    private VehicleModel $model;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
        // The seeder's TRUNCATE commits RefreshDatabase's transaction. Without a live
        // one, an exception inside DB::transaction() fails on its savepoint instead.
        if (!DB::getPdo()->inTransaction()) {
            DB::getPdo()->beginTransaction();
        }
        Storage::fake('local');

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole('owner');

        $this->otherOwner = User::factory()->create();
        $this->otherShop = RentalShop::factory()->create(['owner_user_id' => $this->otherOwner->id]);
        $this->otherOwner->update(['shop_id' => $this->otherShop->id]);
        $this->otherOwner->setShopRole('owner');

        ShopSettings::createFor($this->shop->id);

        $this->buyer = Customer::factory()->create();
        $this->otherBuyer = Customer::factory()->create();

        $this->category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $this->brand = VehicleBrand::create(['name' => 'Toyota', 'slug' => 'toyota', 'is_active' => true]);
        $this->model = VehicleModel::create(['brand_id' => $this->brand->id, 'name' => 'Aqua', 'slug' => 'aqua', 'is_active' => true]);
    }

    private function as($actor)
    {
        $this->app['auth']->forgetGuards();
        VendorContext::forget();

        return $this->withHeader('Authorization', 'Bearer ' . $actor->createToken('test')->plainTextToken);
    }

    private function asGuest()
    {
        $this->app['auth']->forgetGuards();
        VendorContext::forget();

        return $this->withoutHeader('Authorization');
    }

    private function vehicle(array $attributes = []): Vehicle
    {
        VendorContext::forget();

        return Vehicle::withoutGlobalScopes()->create($attributes + [
            'shop_id' => $this->shop->id, 'category_id' => $this->category->id, 'title' => 'Test Car',
            'slug' => 'car-' . Str::lower(Str::random(8)), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAB-' . random_int(1000, 9999), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function rentalCar(array $attributes = []): Vehicle
    {
        $vehicle = $this->vehicle($attributes);
        VehiclePricing::create(['vehicle_id' => $vehicle->id, 'daily_rate' => 7000]);

        return $vehicle;
    }

    private function saleCar(array $attributes = [], array $detail = []): Vehicle
    {
        $vehicle = $this->vehicle($attributes + ['listing_type' => Vehicle::LISTING_SALE]);
        VehicleSaleDetail::create($detail + [
            'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id, 'price' => 5000000,
            'mileage_km' => 42000, 'condition' => 'used', 'sale_status' => VehicleSaleDetail::STATUS_AVAILABLE,
        ]);

        return $vehicle;
    }

    private function openEnquiry(Vehicle $vehicle, ?Customer $customer = null): string
    {
        return $this->as($customer ?? $this->buyer)
            ->postJson('/api/sales/enquiries', ['vehicle_slug' => $vehicle->slug, 'body' => 'Is it available?'])
            ->assertCreated()->json('data.reference');
    }

    private function saleData(array $overrides = []): array
    {
        return $overrides + [
            'buyer_name' => 'Nimal Perera', 'buyer_phone' => '0771234567', 'buyer_nic' => '901234567V',
            'sale_price' => 4800000, 'payment_method' => 'cash',
        ];
    }

    private function listingData(array $overrides = []): array
    {
        return $overrides + [
            'category_id' => $this->category->id, 'brand_id' => $this->brand->id, 'model_id' => $this->model->id,
            'title' => 'Aqua for sale', 'year' => 2019, 'registration_number' => 'CAB-' . random_int(1000, 9999),
            'transmission' => 'automatic', 'fuel_type' => 'hybrid', 'seating_capacity' => 5,
            'price' => 5500000, 'mileage_km' => 60000, 'condition' => 'used', 'is_negotiable' => true,
        ];
    }

    private function onPlan(string $code): void
    {
        ShopSubscription::where('shop_id', $this->shop->id)->update([
            'plan_id' => SubscriptionPlan::where('code', $code)->value('id'),
        ]);
    }

    // ── Rent and sale stay apart ─────────────────────────────────────────

    public function test_a_car_for_sale_never_appears_on_any_rental_surface(): void
    {
        $sale = $this->saleCar(['title' => 'Sale Only Car']);
        $rental = $this->rentalCar(['title' => 'Rental Car']);

        $titles = $this->asGuest()->getJson('/api/public/vehicles')->assertOk()->json('data.*.title');
        $this->assertSame(['Rental Car'], $titles);

        $this->asGuest()->getJson("/api/public/vehicles/{$sale->slug}")->assertNotFound();
        $this->asGuest()->getJson("/api/public/vehicles/{$sale->slug}/availability")->assertNotFound();
        $this->asGuest()->postJson('/api/public/inquiries', ['vehicle_slug' => $sale->slug, 'name' => 'A', 'phone' => '0771234567', 'message' => 'Hi'])->assertNotFound();

        $shopTitles = $this->asGuest()->getJson("/api/public/shops/{$this->shop->slug}/vehicles")->assertOk()->json('data.*.title');
        $this->assertSame(['Rental Car'], $shopTitles);

        $this->as($this->owner)->getJson('/api/vehicles')->assertOk()->assertJsonCount(1, 'record.data');
        $this->assertSame($rental->id, $this->as($this->owner)->getJson('/api/vehicles')->json('record.data.0.id'));
    }

    public function test_a_car_for_sale_cannot_be_booked_or_favorited(): void
    {
        $sale = $this->saleCar();

        $this->as($this->buyer)->postJson('/api/bookings', [
            'vehicle_id' => $sale->id,
            'pickup_at' => now()->addDays(3)->toDateTimeString(),
            'return_at' => now()->addDays(5)->toDateTimeString(),
        ])->assertNotFound();
        $this->assertSame(0, DB::table('bookings')->count());

        $this->as($this->buyer)->postJson("/api/favorites/{$sale->id}")->assertNotFound();
    }

    public function test_a_favorited_rental_that_moves_to_sale_drops_out_of_favorites(): void
    {
        $rental = $this->rentalCar();
        $this->as($this->buyer)->postJson("/api/favorites/{$rental->id}")->assertCreated();
        $this->as($this->buyer)->getJson('/api/favorites')->assertJsonCount(1, 'data');

        DB::table('vehicles')->where('id', $rental->id)->update(['listing_type' => Vehicle::LISTING_SALE]);

        $this->as($this->buyer)->getJson('/api/favorites')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_rental_endpoints_refuse_a_sale_car_and_sale_endpoints_refuse_a_rental(): void
    {
        $sale = $this->saleCar();
        $rental = $this->rentalCar();

        $this->as($this->owner)->getJson("/api/vehicles/{$sale->id}")->assertNotFound();
        $this->as($this->owner)->postJson("/api/vehicles/{$sale->id}/publish")->assertNotFound();
        $this->as($this->owner)->putJson("/api/vehicles/{$sale->id}/pricing", ['daily_rate' => 1000])->assertNotFound();
        $this->as($this->owner)->postJson("/api/vehicles/{$sale->id}/availability/block", ['from' => now()->addDay()->toDateString(), 'to' => now()->addDays(2)->toDateString()])->assertNotFound();

        $this->as($this->owner)->getJson("/api/vendor/sales/listings/{$rental->id}")->assertNotFound();
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$rental->id}/sell", $this->saleData())->assertNotFound();
    }

    public function test_the_buy_page_lists_only_available_cars_with_nothing_private(): void
    {
        $this->rentalCar(['title' => 'Rental Car']);
        $car = $this->saleCar(['title' => 'For Sale', 'registration_number' => 'SECRET-1', 'condition_notes' => 'Secret note']);
        $this->saleCar(['title' => 'Sold Car'], ['sale_status' => VehicleSaleDetail::STATUS_SOLD]);
        $this->saleCar(['title' => 'Withdrawn Car'], ['sale_status' => VehicleSaleDetail::STATUS_WITHDRAWN]);
        $this->saleCar(['title' => 'Draft Car', 'status' => Vehicle::STATUS_DRAFT]);

        $response = $this->asGuest()->getJson('/api/public/buy')->assertOk();
        $this->assertSame(['For Sale'], $response->json('data.*.title'));
        $this->assertStringNotContainsString('SECRET-1', $response->getContent());
        $this->assertStringNotContainsString('Secret note', $response->getContent());
        $this->assertArrayNotHasKey('registration_number', $response->json('data.0'));

        $detail = $this->asGuest()->getJson("/api/public/buy/{$car->slug}")->assertOk();
        $this->assertSame(42000, $detail->json('data.mileage_km'));
        $this->assertArrayHasKey('colour_hex', $detail->json('data'));
    }

    public function test_the_buy_page_filters_and_sorts_with_featured_cars_first(): void
    {
        $cheap = $this->saleCar(['title' => 'Cheap'], ['price' => 2000000]);
        $dear = $this->saleCar(['title' => 'Dear'], ['price' => 9000000, 'condition' => 'brand_new']);
        Promotion::create([
            'reference_no' => 'PRM-1', 'shop_id' => $this->shop->id, 'type' => Promotion::TYPE_FEATURED, 'vehicle_id' => $dear->id,
            'days' => 7, 'amount' => 0, 'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED,
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(6),
        ]);

        $this->assertSame(['Cheap'], $this->asGuest()->getJson('/api/public/buy?price_max=3000000')->json('data.*.title'));
        $this->assertSame(['Dear'], $this->asGuest()->getJson('/api/public/buy?condition=brand_new')->json('data.*.title'));

        // Featured goes first even in a price sort it would otherwise lose.
        $sorted = $this->asGuest()->getJson('/api/public/buy?sort=price_asc')->assertOk();
        $this->assertSame(['Dear', 'Cheap'], $sorted->json('data.*.title'));
        $this->assertTrue($sorted->json('data.0.is_featured'));
    }

    public function test_the_buy_page_filters_offer_only_what_is_for_sale(): void
    {
        $unused = VehicleBrand::create(['name' => 'Rental Only', 'slug' => 'rental-only', 'is_active' => true]);
        $this->rentalCar(['brand_id' => $unused->id]);
        $this->shop->update(['city' => 'Kandy', 'district' => 'Kandy']);
        $this->saleCar(['brand_id' => $this->brand->id, 'model_id' => $this->model->id, 'seating_capacity' => 7]);
        $this->saleCar(['brand_id' => $this->brand->id, 'model_id' => $this->model->id, 'seating_capacity' => 4]);
        $this->saleCar(['brand_id' => $unused->id], ['sale_status' => VehicleSaleDetail::STATUS_SOLD]);

        $options = $this->asGuest()->getJson("/api/public/buy/filters?brand_id={$this->brand->id}")->assertOk();
        $this->assertSame(['Toyota'], $options->json('data.brands.*.name'));
        $this->assertSame(['Aqua'], $options->json('data.models.*.name'));
        $this->assertSame([['city' => 'Kandy', 'district' => 'Kandy', 'vehicle_count' => 2]], $options->json('data.locations'));

        $this->assertSame([], $this->asGuest()->getJson('/api/public/buy/filters')->json('data.models'));
        $this->asGuest()->getJson('/api/public/buy?seats_min=5')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_a_shops_page_lists_its_cars_for_sale_apart_from_its_rentals(): void
    {
        $this->rentalCar(['title' => 'Rental Car']);
        $this->saleCar(['title' => 'For Sale']);
        $this->saleCar(['title' => 'Sold Car'], ['sale_status' => VehicleSaleDetail::STATUS_SOLD]);
        $this->saleCar(['title' => 'Other Shop Car', 'shop_id' => $this->otherShop->id]);

        $this->assertSame(['For Sale'], $this->asGuest()->getJson("/api/public/shops/{$this->shop->slug}/sale-vehicles")->assertOk()->json('data.*.title'));
        $this->assertSame(['Rental Car'], $this->asGuest()->getJson("/api/public/shops/{$this->shop->slug}/vehicles")->assertOk()->json('data.*.title'));

        $shop = $this->asGuest()->getJson("/api/public/shops/{$this->shop->slug}")->assertOk();
        $this->assertSame(1, $shop->json('data.vehicles_count'));
        $this->assertSame(1, $shop->json('data.sale_vehicles_count'));

        $directory = collect($this->asGuest()->getJson('/api/public/shops')->assertOk()->json('data'))->keyBy('slug');
        $this->assertSame(1, $directory[$this->shop->slug]['sale_vehicles_count']);
    }

    public function test_a_shops_cars_for_sale_count_in_the_directory_filters_and_sort(): void
    {
        $other = VehicleCategory::create(['name' => 'Van', 'slug' => 'van', 'sort_order' => 2, 'is_active' => true]);
        $this->saleCar(['category_id' => $other->id]);
        $this->saleCar(['category_id' => $other->id]);
        $this->rentalCar(['shop_id' => $this->otherShop->id]);

        $this->assertSame([$this->shop->slug], $this->asGuest()->getJson("/api/public/shops?category_id={$other->id}")->assertOk()->json('data.*.slug'));
        $this->assertSame($this->shop->slug, $this->asGuest()->getJson('/api/public/shops?sort=fleet')->assertOk()->json('data.0.slug'));
    }

    public function test_the_dashboards_report_sales(): void
    {
        $car = $this->saleCar();
        $this->openEnquiry($car);
        $sold = $this->saleCar();
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$sold->id}/sell", $this->saleData())->assertCreated();

        $sales = $this->as($this->owner)->getJson('/api/dashboard')->assertOk()->json('data.sales');
        $this->assertSame(1, $sales['for_sale']);
        $this->assertSame(1, $sales['enquiries_waiting']);
        $this->assertSame(1, $sales['sold_this_month']);
        $this->assertEquals(4800000, $sales['sold_value_this_month']);

        $this->assertSame(0, $this->as($this->otherOwner)->getJson('/api/dashboard')->json('data.sales.sold_this_month'));

        SubscriptionPlan::where('code', 'basic')->update(['features' => json_encode([])]);
        $this->onPlan('basic');
        $this->assertNull($this->as($this->owner)->getJson('/api/dashboard')->assertOk()->json('data.sales'));
    }

    public function test_a_buyer_sees_only_their_own_notifications(): void
    {
        $reference = $this->openEnquiry($this->saleCar());
        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$reference}/messages", ['body' => 'Yes'])->assertOk();

        $list = $this->as($this->buyer)->getJson('/api/customer/notifications')->assertOk();
        $this->assertSame(1, $list->json('unread_count'));
        $this->assertSame("/account/enquiries/{$reference}", $list->json('record.data.0.data.action_url'));
        $id = $list->json('record.data.0.id');

        $this->as($this->otherBuyer)->getJson('/api/customer/notifications')->assertOk()->assertJsonPath('unread_count', 0);
        $this->as($this->otherBuyer)->postJson("/api/customer/notifications/{$id}/read")->assertNotFound();

        $this->as($this->buyer)->postJson("/api/customer/notifications/{$id}/read")->assertOk();
        $this->as($this->buyer)->getJson('/api/customer/notifications')->assertJsonPath('unread_count', 0);
    }

    public function test_the_help_pages_cover_buying(): void
    {
        $privacy = DB::table('help_items')->where('type', 'privacy')->where('title', 'If you buy a vehicle')->value('body');
        $this->assertStringContainsString('NIC number', $privacy);
        $this->assertSame(1, DB::table('help_items')->where('type', 'terms')->where('title', 'Buying a vehicle')->count());
        $this->assertTrue(DB::table('help_items')->where('type', 'faq')->where('section', 'Buying a vehicle')->exists());
        $this->assertTrue(DB::table('help_items')->where('type', 'safety_tip')->where('section', 'Buying a vehicle')->exists());
    }

    // ── Listings ─────────────────────────────────────────────────────────

    public function test_a_shop_creates_a_listing_that_starts_as_a_draft_awaiting_moderation(): void
    {
        $id = $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertCreated()->json('data.id');

        $vehicle = Vehicle::withoutGlobalScopes()->find($id);
        $this->assertSame(Vehicle::LISTING_SALE, $vehicle->listing_type);
        $this->assertSame(Vehicle::STATUS_DRAFT, $vehicle->status);
        $this->assertSame(Vehicle::MODERATION_PENDING, $vehicle->moderation_status);
        $this->assertSame(60000, VehicleSaleDetail::find($id)->mileage_km);

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$id}/publish")->assertStatus(422);
    }

    public function test_only_a_used_car_must_have_a_registration_number(): void
    {
        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData(['registration_number' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('registration_number');

        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData(['registration_number' => null, 'condition' => 'reconditioned']))
            ->assertCreated();
    }

    public function test_sale_listings_have_their_own_plan_limit(): void
    {
        $this->onPlan('basic'); // 2 sale listings, 2 vehicles
        $this->rentalCar();
        $this->rentalCar();

        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertCreated();
        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertCreated();
        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertForbidden();

        $usage = $this->as($this->owner)->getJson('/api/vendor/subscription/summary')->assertOk()->json('data.usage');
        $this->assertSame(2, $usage['vehicles']);
        $this->assertSame(2, $usage['sale_listings']);
    }

    public function test_selling_a_car_frees_its_listing_slot(): void
    {
        $this->onPlan('basic');
        $this->saleCar();
        $sold = $this->saleCar();
        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertForbidden();

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$sold->id}/sell", $this->saleData())->assertCreated();

        $this->as($this->owner)->postJson('/api/vendor/sales/listings', $this->listingData())->assertCreated();
    }

    public function test_a_plan_without_sales_cannot_reach_the_sales_workspace(): void
    {
        $plan = SubscriptionPlan::where('code', 'basic')->first();
        $plan->update(['features' => []]);
        $this->onPlan('basic');
        $car = $this->saleCar();

        $this->as($this->owner)->getJson('/api/vendor/sales/listings')->assertForbidden()->assertJsonPath('code', 'plan_feature');

        // Nobody could answer, so buyers can't ask either.
        $this->as($this->buyer)->postJson('/api/sales/enquiries', ['vehicle_slug' => $car->slug, 'body' => 'Hi'])->assertStatus(422);
    }

    public function test_staff_need_the_sales_permissions(): void
    {
        $staff = User::factory()->create(['shop_id' => $this->shop->id]);
        $role = Role::create(['name' => 'Rentals only', 'guard_name' => 'web', 'shop_id' => $this->shop->id]);
        $role->givePermissionTo('vendor-vehicles-list-view', 'vendor-vehicles-list-edit');
        $staff->setShopRole($role);
        $car = $this->saleCar();

        $this->as($staff)->getJson('/api/vendor/sales/listings')->assertForbidden();
        $this->as($staff)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData())->assertForbidden();
        $this->as($staff)->getJson('/api/vendor/sales/sold')->assertForbidden();
        // The rental permission doesn't reach a sale listing's photos either.
        $this->as($staff)->getJson("/api/vehicles/{$car->id}/images")->assertForbidden();
    }

    // ── Enquiries ────────────────────────────────────────────────────────

    public function test_asking_again_adds_to_the_open_enquiry(): void
    {
        $car = $this->saleCar();

        $first = $this->openEnquiry($car);
        $second = $this->openEnquiry($car);

        $this->assertSame($first, $second);
        $this->assertSame(1, SaleEnquiry::withoutGlobalScopes()->count());
        $this->assertSame(2, SaleEnquiry::withoutGlobalScopes()->first()->messages()->count());
        $this->assertSame(1, (int) DB::table('vehicles')->where('id', $car->id)->value('inquiry_count'));

        // A different buyer has their own conversation.
        $this->assertNotSame($first, $this->openEnquiry($car, $this->otherBuyer));
    }

    public function test_a_buyer_can_only_enquire_about_a_car_on_the_buy_page(): void
    {
        $rental = $this->rentalCar();
        $sold = $this->saleCar([], ['sale_status' => VehicleSaleDetail::STATUS_SOLD]);

        foreach ([$rental, $sold] as $vehicle) {
            $this->as($this->buyer)->postJson('/api/sales/enquiries', ['vehicle_slug' => $vehicle->slug, 'body' => 'Hi'])->assertNotFound();
        }
    }

    public function test_the_conversation_goes_both_ways_and_tracks_what_is_unread(): void
    {
        $reference = $this->openEnquiry($this->saleCar());

        $inbox = $this->as($this->owner)->getJson('/api/vendor/sales/enquiries')->assertOk();
        $this->assertSame(1, $inbox->json('record.data.0.unread_count'));
        $this->assertSame($this->buyer->email, $inbox->json('record.data.0.customer.email'));

        $this->as($this->owner)->getJson("/api/vendor/sales/enquiries/{$reference}")->assertOk();
        $this->assertSame(0, $this->as($this->owner)->getJson('/api/vendor/sales/enquiries')->json('record.data.0.unread_count'));

        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$reference}/messages", ['body' => 'Yes, come by.'])->assertOk()
            ->assertJsonPath('data.status', SaleEnquiry::STATUS_REPLIED);

        $this->assertSame(1, $this->as($this->buyer)->getJson('/api/sales/enquiries')->assertOk()->json('record.data.0.unread_count'));
        $thread = $this->as($this->buyer)->getJson("/api/sales/enquiries/{$reference}")->assertOk();
        $this->assertSame(['Is it available?', 'Yes, come by.'], $thread->json('data.messages.*.body'));
        $this->assertArrayNotHasKey('customer', $thread->json('data'));

        $this->as($this->buyer)->postJson("/api/sales/enquiries/{$reference}/messages", ['body' => 'Saturday?'])->assertOk()
            ->assertJsonPath('data.status', SaleEnquiry::STATUS_NEW);

        $this->as($this->buyer)->postJson("/api/sales/enquiries/{$reference}/close")->assertOk();
        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$reference}/messages", ['body' => 'Too late'])->assertStatus(422);
    }

    public function test_the_shops_inbox_previews_the_last_message_and_filters_unread(): void
    {
        $answered = $this->openEnquiry($this->saleCar());
        $waiting = $this->openEnquiry($this->saleCar());
        $this->as($this->owner)->getJson("/api/vendor/sales/enquiries/{$answered}")->assertOk(); // read it
        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$answered}/messages", ['body' => 'Come on Saturday.'])->assertOk();

        $inbox = $this->as($this->owner)->getJson('/api/vendor/sales/enquiries')->assertOk();
        $row = collect($inbox->json('record.data'))->firstWhere('reference', $answered);
        $this->assertSame(['sender_type' => 'shop', 'body' => 'Come on Saturday.'], array_intersect_key($row['last_message'], array_flip(['sender_type', 'body'])));
        $this->assertArrayHasKey('image_url', $row['vehicle']);

        $this->assertSame([$waiting], $this->as($this->owner)->getJson('/api/vendor/sales/enquiries?unread=1')->json('record.data.*.reference'));
    }

    public function test_the_buyers_inbox_previews_the_last_message_and_filters_open_and_closed(): void
    {
        $openRef = $this->openEnquiry($this->saleCar());
        $closedRef = $this->openEnquiry($this->saleCar());
        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$openRef}/messages", ['body' => 'Yes, it is still available.'])->assertOk();
        $this->as($this->buyer)->postJson("/api/sales/enquiries/{$closedRef}/close")->assertOk();

        $all = $this->as($this->buyer)->getJson('/api/sales/enquiries')->assertOk();
        $this->assertSame(2, $all->json('record.total'));
        $row = collect($all->json('record.data'))->firstWhere('reference', $openRef);
        $this->assertSame('shop', $row['last_message']['sender_type']);
        $this->assertSame('Yes, it is still available.', $row['last_message']['body']);
        $this->assertArrayHasKey('logo_url', $row['shop']);

        $this->assertSame([$openRef], $this->as($this->buyer)->getJson('/api/sales/enquiries?status=open')->json('record.data.*.reference'));
        $this->assertSame([$closedRef], $this->as($this->buyer)->getJson('/api/sales/enquiries?status=closed')->json('record.data.*.reference'));
    }

    public function test_enquiries_and_sales_stay_inside_their_shop_and_with_their_buyer(): void
    {
        $car = $this->saleCar();
        $reference = $this->openEnquiry($car);
        $sale = $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData(['enquiry_reference' => $reference]))
            ->assertCreated()->json('data.reference');

        $this->as($this->otherOwner)->getJson("/api/vendor/sales/enquiries/{$reference}")->assertNotFound();
        $this->as($this->otherOwner)->postJson("/api/vendor/sales/enquiries/{$reference}/messages", ['body' => 'Hi'])->assertNotFound();
        $this->as($this->otherOwner)->getJson("/api/vendor/sales/sold/{$sale}")->assertNotFound();
        $this->as($this->otherOwner)->getJson("/api/vendor/sales/sold/{$sale}/agreement")->assertNotFound();
        $this->as($this->otherOwner)->getJson("/api/vendor/sales/listings/{$car->id}")->assertNotFound();
        $this->assertSame(0, $this->as($this->otherOwner)->getJson('/api/vendor/sales/sold')->json('record.total'));

        $this->as($this->otherBuyer)->getJson("/api/sales/enquiries/{$reference}")->assertNotFound();
        $this->as($this->otherBuyer)->getJson("/api/sales/enquiries/{$reference}/agreement")->assertNotFound();
        $this->assertSame(0, $this->as($this->otherBuyer)->getJson('/api/sales/enquiries')->json('record.total'));
    }

    // ── Switching type ───────────────────────────────────────────────────

    private function moveToSale(Vehicle $vehicle)
    {
        return $this->as($this->owner)->postJson("/api/vendor/sales/vehicles/{$vehicle->id}/move-to-sale", ['price' => 3000000, 'mileage_km' => 80000, 'condition' => 'used']);
    }

    private function booking(Vehicle $vehicle, string $status): Booking
    {
        return Booking::withoutGlobalScopes()->create([
            'booking_reference' => 'BKG-' . Str::upper(Str::random(8)), 'vehicle_id' => $vehicle->id, 'shop_id' => $vehicle->shop_id,
            'customer_id' => $this->buyer->id, 'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3, 'status' => $status,
        ]);
    }

    public function test_a_rental_with_any_booking_in_play_cannot_move_to_sale(): void
    {
        foreach ([Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE] as $status) {
            $rental = $this->rentalCar();
            $this->booking($rental, $status);

            $this->moveToSale($rental)->assertStatus(422)->assertJsonValidationErrors('listing_type');
            $this->assertSame(Vehicle::LISTING_RENT, $rental->fresh()->listing_type);
        }
    }

    public function test_a_rental_moves_to_sale_off_the_market_and_keeps_its_booking_history(): void
    {
        $rental = $this->rentalCar();
        $booking = $this->booking($rental, Booking::STATUS_COMPLETED);

        $this->moveToSale($rental)->assertOk();

        $vehicle = Vehicle::withoutGlobalScopes()->find($rental->id);
        $this->assertSame(Vehicle::LISTING_SALE, $vehicle->listing_type);
        $this->assertSame(Vehicle::STATUS_UNPUBLISHED, $vehicle->status);
        $this->assertSame(Vehicle::MODERATION_PENDING, $vehicle->moderation_status);
        $this->assertSame(VehicleSaleDetail::STATUS_WITHDRAWN, VehicleSaleDetail::find($rental->id)->sale_status);
        $this->assertNotNull(VehiclePricing::where('vehicle_id', $rental->id)->first());

        $this->asGuest()->getJson('/api/public/buy')->assertJsonCount(0, 'data');
        $this->as($this->owner)->getJson("/api/vendor/bookings/{$booking->booking_reference}")->assertOk();
        $this->as($this->buyer)->getJson("/api/bookings/{$booking->booking_reference}")->assertOk();
    }

    public function test_moving_type_cannot_shake_off_a_platform_takedown(): void
    {
        $rental = $this->rentalCar(['moderation_status' => Vehicle::MODERATION_FLAGGED, 'status' => Vehicle::STATUS_UNPUBLISHED]);

        $this->moveToSale($rental)->assertOk();

        $this->assertSame(Vehicle::MODERATION_FLAGGED, Vehicle::withoutGlobalScopes()->find($rental->id)->moderation_status);
    }

    public function test_a_sale_car_with_open_enquiries_cannot_move_to_rentals_until_they_are_closed(): void
    {
        $car = $this->saleCar();
        $reference = $this->openEnquiry($car);

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/move-to-rent")->assertStatus(422)->assertJsonValidationErrors('listing_type');

        $this->as($this->owner)->postJson("/api/vendor/sales/enquiries/{$reference}/close")->assertOk();
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/move-to-rent")->assertOk();

        $vehicle = Vehicle::withoutGlobalScopes()->find($car->id);
        $this->assertSame(Vehicle::LISTING_RENT, $vehicle->listing_type);
        $this->assertSame(Vehicle::STATUS_UNPUBLISHED, $vehicle->status);
    }

    public function test_an_unregistered_or_sold_car_cannot_move_to_rentals(): void
    {
        $unregistered = $this->saleCar(['registration_number' => null], ['condition' => 'brand_new']);
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$unregistered->id}/move-to-rent")->assertStatus(422)->assertJsonValidationErrors('registration_number');

        $sold = $this->saleCar([], ['sale_status' => VehicleSaleDetail::STATUS_SOLD]);
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$sold->id}/move-to-rent")->assertStatus(422);
    }

    // ── Recording a sale ─────────────────────────────────────────────────

    public function test_recording_a_sale_closes_the_car_out_everywhere(): void
    {
        $car = $this->saleCar();
        $winner = $this->openEnquiry($car);
        $loser = $this->openEnquiry($car, $this->otherBuyer);
        Promotion::create([
            'reference_no' => 'PRM-2', 'shop_id' => $this->shop->id, 'type' => Promotion::TYPE_FEATURED, 'vehicle_id' => $car->id,
            'days' => 7, 'amount' => 0, 'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED,
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(6),
        ]);

        $response = $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData(['enquiry_reference' => $winner]))
            ->assertCreated();
        $this->assertStringStartsWith('SAL-', $response->json('data.reference'));
        $this->assertArrayNotHasKey('buyer_nic', $response->json('data'));

        $sale = VehicleSale::withoutGlobalScopes()->first();
        $this->assertSame($this->buyer->id, $sale->customer_id);
        $this->assertSame($this->owner->id, $sale->recorded_by);
        $this->assertSame('901234567V', $sale->buyer_nic);
        $this->assertNotSame('901234567V', DB::table('vehicle_sales')->value('buyer_nic'));

        $this->assertSame(VehicleSaleDetail::STATUS_SOLD, VehicleSaleDetail::find($car->id)->sale_status);
        $this->assertSame(Vehicle::STATUS_UNPUBLISHED, Vehicle::withoutGlobalScopes()->find($car->id)->status);
        $this->asGuest()->getJson('/api/public/buy')->assertJsonCount(0, 'data');
        $this->assertFalse(Promotion::live()->where('vehicle_id', $car->id)->exists());

        $enquiries = SaleEnquiry::withoutGlobalScopes()->get()->keyBy('reference');
        $this->assertSame(SaleEnquiry::STATUS_ACCEPTED, $enquiries[$winner]->status);
        $this->assertSame(SaleEnquiry::STATUS_CLOSED, $enquiries[$loser]->status);
        $this->assertSame('Sold to another buyer', $enquiries[$loser]->closed_reason);
    }

    public function test_a_walk_in_sale_needs_no_customer_account(): void
    {
        $car = $this->saleCar();

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData())->assertCreated();

        $this->assertNull(VehicleSale::withoutGlobalScopes()->first()->customer_id);
    }

    public function test_a_car_is_sold_once_and_stays_sold(): void
    {
        $car = $this->saleCar();
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData())->assertCreated();

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData())->assertStatus(422);
        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/publish")->assertStatus(422);
        $this->as($this->owner)->putJson("/api/vendor/sales/listings/{$car->id}", ['price' => 1])->assertStatus(422);
        $this->as($this->owner)->deleteJson("/api/vendor/sales/listings/{$car->id}")->assertStatus(422);

        $this->assertSame(1, VehicleSale::withoutGlobalScopes()->count());
        $this->as($this->owner)->getJson('/api/vendor/sales/listings')->assertJsonCount(1, 'record.data');
    }

    public function test_an_enquiry_about_another_car_cannot_be_used_for_the_sale(): void
    {
        $reference = $this->openEnquiry($this->saleCar());
        $car = $this->saleCar();

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData(['enquiry_reference' => $reference]))
            ->assertStatus(422)->assertJsonValidationErrors('enquiry_reference');
    }

    public function test_with_sale_terms_the_buyer_must_agree_and_sign(): void
    {
        $this->as($this->owner)->putJson('/api/vendor/sales/terms', ['terms' => '<h2 onclick="x()">Sold as seen</h2><script>bad()</script>'])
            ->assertOk()->assertJsonPath('data.terms', '<h2>Sold as seen</h2>bad()');
        $car = $this->saleCar();
        $url = "/api/vendor/sales/listings/{$car->id}/sell";

        $this->as($this->owner)->postJson($url, $this->saleData())->assertStatus(422)->assertJsonValidationErrors('terms_accepted');
        $this->as($this->owner)->postJson($url, $this->saleData(['terms_accepted' => true]))->assertStatus(422)->assertJsonValidationErrors('customer_signature');
        $this->assertSame(VehicleSaleDetail::STATUS_AVAILABLE, VehicleSaleDetail::find($car->id)->sale_status);

        $this->as($this->owner)->postJson($url, $this->saleData(['terms_accepted' => true, 'customer_signature' => self::SIGNATURE]))->assertCreated();

        $sale = VehicleSale::withoutGlobalScopes()->first();
        $this->assertStringContainsString('Sold as seen', $sale->terms_snapshot);
        $this->assertNotNull($sale->terms_accepted_at);
        Storage::disk('local')->assertExists("signatures/{$this->shop->id}/{$sale->reference}-sale.png");

        // Later edits never change what was signed.
        $this->as($this->owner)->putJson('/api/vendor/sales/terms', ['terms' => '<p>New terms</p>'])->assertOk();
        $this->assertStringContainsString('Sold as seen', $sale->fresh()->terms_snapshot);
    }

    public function test_the_shop_and_the_buyer_can_open_the_sale_agreement(): void
    {
        $car = $this->saleCar();
        $enquiry = $this->openEnquiry($car);
        $reference = $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData(['enquiry_reference' => $enquiry]))
            ->json('data.reference');

        $vendor = $this->as($this->owner)->get("/api/vendor/sales/sold/{$reference}/agreement")->assertOk();
        $this->assertStringContainsString('application/pdf', $vendor->headers->get('Content-Type'));

        $buyer = $this->as($this->buyer)->get("/api/sales/enquiries/{$enquiry}/agreement")->assertOk();
        $this->assertStringContainsString('application/pdf', $buyer->headers->get('Content-Type'));

        $this->assertSame($reference, $this->as($this->buyer)->getJson("/api/sales/enquiries/{$enquiry}")->json('data.sale.reference'));
    }

    public function test_the_buyers_nic_shows_only_on_the_audited_sale_page(): void
    {
        $car = $this->saleCar();
        $reference = $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/sell", $this->saleData())->json('data.reference');

        $this->assertArrayNotHasKey('buyer_nic', $this->as($this->owner)->getJson('/api/vendor/sales/sold')->json('record.data.0'));
        $this->as($this->owner)->getJson("/api/vendor/sales/sold/{$reference}")->assertOk()->assertJsonPath('data.buyer_nic', '901234567V');
    }

    public function test_deleting_a_listing_closes_its_enquiries(): void
    {
        $car = $this->saleCar();
        $reference = $this->openEnquiry($car);

        $this->as($this->owner)->deleteJson("/api/vendor/sales/listings/{$car->id}")->assertOk();

        $this->assertSame(SaleEnquiry::STATUS_CLOSED, SaleEnquiry::withoutGlobalScopes()->where('reference', $reference)->value('status'));
        // The buyer can still read the conversation about the deleted car.
        $this->as($this->buyer)->getJson("/api/sales/enquiries/{$reference}")->assertOk()->assertJsonPath('data.vehicle.id', $car->id);
    }

    public function test_withdrawing_takes_a_car_off_the_buy_page_and_publishing_brings_it_back(): void
    {
        $car = $this->saleCar();

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/withdraw")->assertOk();
        $this->asGuest()->getJson('/api/public/buy')->assertJsonCount(0, 'data');

        $this->as($this->owner)->postJson("/api/vendor/sales/listings/{$car->id}/publish")->assertOk();
        $this->asGuest()->getJson('/api/public/buy')->assertJsonCount(1, 'data');
    }
}
