<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingInspection;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Shop terms & conditions, signed by the customer on screen at handover — RentalAgreementService. */
class RentalAgreementTest extends TestCase
{
    use RefreshDatabase;

    /** A 1×1 PNG, as the signature pad would send it. */
    private const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private User $owner;
    private RentalShop $shop;
    private Customer $customer;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
        Storage::fake('local');

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole(User::SHOP_ROLE_OWNER);
        ShopSettings::createFor($this->shop->id);

        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::withoutGlobalScopes()->create([
            'shop_id' => $this->shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        $this->customer = Customer::factory()->create();
        $booking = Booking::withoutGlobalScopes()->create([
            'booking_reference' => 'BKG-AGR-001', 'vehicle_id' => $vehicle->id, 'shop_id' => $this->shop->id,
            'customer_id' => $this->customer->id, 'payment_method' => Booking::METHOD_CASH,
            'pickup_at' => now()->addHour(), 'return_at' => now()->addDays(2), 'rental_days' => 2, 'status' => Booking::STATUS_PENDING,
        ]);
        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR', 'pricing_snapshot' => ['security_deposit' => 0, 'deposit_method' => 'waived'],
            'rate_plan' => 'daily', 'rate_breakdown' => [], 'base_amount' => 14000, 'subtotal' => 14000, 'security_deposit' => 0, 'total_payable' => 14000,
            'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'BKG-AGR-001'),
        ]);
        $this->booking = app(TransitionBooking::class)->accept($booking->fresh(), $this->owner->id);
    }

    private function asOwner()
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $this->owner->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function handover(array $extra = [])
    {
        return $this->asOwner()->postJson("/api/vendor/bookings/{$this->booking->booking_reference}/handover", ['cash_received' => true] + $extra);
    }

    public function test_the_shop_writes_its_own_terms(): void
    {
        $this->asOwner()->getJson('/api/vendor/terms')->assertOk()->assertJsonPath('data.terms', '');
        $this->asOwner()->putJson('/api/vendor/terms', ['terms' => "1. Minimum age 21.\n2. Full-to-full fuel."])->assertOk();

        $this->assertSame("1. Minimum age 21.\n2. Full-to-full fuel.", ShopSettings::where('shop_id', $this->shop->id)->value('agreement_terms'));
    }

    public function test_rich_text_terms_keep_formatting_but_lose_scripts_links_and_attributes(): void
    {
        $html = '<h2 onclick="x()">Rules</h2><ol><li><p><strong>No</strong> <u>smoking</u></p></li></ol>'
            . '<script>alert(1)</script><p style="color:red"><a href="https://evil.test">link</a><img src=x onerror=alert(1)></p>';
        $this->asOwner()->putJson('/api/vendor/terms', ['terms' => $html])->assertOk();

        $saved = ShopSettings::where('shop_id', $this->shop->id)->value('agreement_terms');
        $this->assertSame('<h2>Rules</h2><ol><li><p><strong>No</strong> <u>smoking</u></p></li></ol>alert(1)<p>link</p>', $saved);

        // An empty editor saves as "no terms".
        $this->asOwner()->putJson('/api/vendor/terms', ['terms' => '<p></p>'])->assertOk();
        $this->assertNull(ShopSettings::where('shop_id', $this->shop->id)->value('agreement_terms'));
    }

    public function test_with_terms_the_customer_must_agree_and_sign_at_handover(): void
    {
        ShopSettings::where('shop_id', $this->shop->id)->update(['agreement_terms' => '1. No smoking.']);

        $this->handover()->assertUnprocessable()->assertJsonValidationErrors('terms_accepted');
        $this->handover(['terms_accepted' => true])->assertUnprocessable()->assertJsonValidationErrors('customer_signature');
        $this->handover(['terms_accepted' => true, 'customer_signature' => 'data:image/png;base64,bm90IGEgcG5n'])->assertUnprocessable()->assertJsonValidationErrors('customer_signature');
        $this->assertSame(Booking::STATUS_CONFIRMED, $this->booking->fresh()->status);

        $this->handover(['terms_accepted' => true, 'customer_signature' => self::SIGNATURE])
            ->assertOk()->assertJsonPath('data.agreement.signed', true);

        $handover = BookingInspection::where('booking_id', $this->booking->id)->where('type', BookingInspection::TYPE_HANDOVER)->firstOrFail();
        $this->assertSame('<p>1. No smoking.</p>', $handover->terms_snapshot);
        $this->assertNotNull($handover->terms_accepted_at);
        Storage::disk('local')->assertExists($handover->customer_signature_path);

        // Editing the terms later never changes what was signed.
        ShopSettings::where('shop_id', $this->shop->id)->update(['agreement_terms' => '1. Changed.']);
        $this->assertSame('<p>1. No smoking.</p>', $handover->fresh()->terms_snapshot);
    }

    public function test_the_shop_and_the_customer_can_open_the_agreement(): void
    {
        ShopSettings::where('shop_id', $this->shop->id)->update(['agreement_terms' => '1. No smoking.']);
        $this->handover(['terms_accepted' => true, 'customer_signature' => self::SIGNATURE])->assertOk();

        $this->asOwner()->get("/api/vendor/bookings/{$this->booking->booking_reference}/agreement")
            ->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $this->customer->createToken('c')->plainTextToken)
            ->get("/api/bookings/{$this->booking->booking_reference}/agreement")
            ->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_the_agreement_and_voucher_can_be_printed_in_tamil(): void
    {
        ShopSettings::where('shop_id', $this->shop->id)->update(['agreement_terms' => '1. No smoking.']);
        $this->handover(['terms_accepted' => true, 'customer_signature' => self::SIGNATURE])->assertOk();
        $ref = $this->booking->booking_reference;

        // The shop's English panel asks for a Tamil copy with ?lang=ta.
        foreach (['agreement', 'voucher'] as $doc) {
            $response = $this->asOwner()->get("/api/vendor/bookings/{$ref}/{$doc}?lang=ta&download=1")->assertOk();
            $this->assertStringStartsWith('%PDF', $response->getContent());
            $this->assertStringContainsString("attachment; filename={$ref}-ta.pdf", $response->headers->get('Content-Disposition'));
        }

        // A customer browsing in Tamil (X-Locale) gets Tamil by default.
        $this->app['auth']->forgetGuards();
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->customer->createToken('c')->plainTextToken,
            'X-Locale' => 'ta',
        ])->get("/api/bookings/{$ref}/agreement?download=1")->assertOk();
        $this->assertStringContainsString("filename={$ref}-ta.pdf", $response->headers->get('Content-Disposition'));
    }

    public function test_without_terms_no_signature_is_needed(): void
    {
        $this->handover()->assertOk()->assertJsonPath('data.agreement.signed', false)->assertJsonPath('data.agreement.has_terms', false);
    }
}
