<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\PlatformDetail;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The whole Tamil cycle: an admin saves Tamil text next to the English,
 * public endpoints serve it to X-Locale: ta visitors (English to everyone
 * else, and to the admin panel), and customers get Tamil errors.
 */
class LocalizationCycleTest extends TestCase
{
    use RefreshDatabase;

    private string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->adminToken = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;
    }

    private function admin()
    {
        return $this->withHeader('Authorization', "Bearer {$this->adminToken}")->withHeader('Accept', 'application/json');
    }

    private function tamil(): array
    {
        return ['X-Locale' => 'ta', 'Accept' => 'application/json'];
    }

    private function publishedVehicle(VehicleCategory $category, array $pricing = []): Vehicle
    {
        $shop = RentalShop::factory()->create(['status' => 'active', 'is_published' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'listing_type' => Vehicle::LISTING_RENT,
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create($pricing + ['vehicle_id' => $vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 0, 'min_rental_days' => 1]);

        return $vehicle;
    }

    // ── Categories ─────────────────────────────────────────────────────

    public function test_category_tamil_name_flows_from_admin_to_public_search_and_shop_cards(): void
    {
        $id = $this->admin()->postJson('/api/platform/categories', [
            'name' => 'Car', 'slug' => 'car', 'is_active' => true,
            'translations' => ['ta' => ['name' => 'கார்']],
        ])->assertCreated()->assertJsonPath('data.translations.ta.name', 'கார்')->json('data.id');

        $vehicle = $this->publishedVehicle(VehicleCategory::findOrFail($id));

        // English visitor (no header) and Tamil visitor.
        $this->getJson('/api/public/categories')->assertJsonPath('data.0.name', 'Car');
        $this->getJson('/api/public/categories', $this->tamil())
            ->assertOk()
            ->assertHeader('Content-Language', 'ta')
            ->assertJsonPath('data.0.name', 'கார்');

        // The category on vehicle cards and the shop directory's type chips follow too.
        $this->getJson("/api/public/vehicles/{$vehicle->slug}", $this->tamil())->assertJsonPath('data.category.name', 'கார்');
        $this->getJson('/api/public/vehicles', $this->tamil())->assertJsonPath('data.0.category.name', 'கார்');
        $this->getJson('/api/public/shops', $this->tamil())->assertJsonPath('data.0.categories', ['கார்']);
        $this->getJson('/api/public/shops')->assertJsonPath('data.0.categories', ['Car']);

        // The admin panel (never sends X-Locale) keeps seeing and editing the English name.
        $this->admin()->getJson("/api/platform/categories/{$id}")
            ->assertJsonPath('data.name', 'Car')
            ->assertJsonPath('data.translations.ta.name', 'கார்');

        // Clearing the Tamil name falls back to English for Tamil visitors.
        $this->admin()->putJson("/api/platform/categories/{$id}", [
            'name' => 'Car', 'slug' => 'car', 'translations' => ['ta' => ['name' => '']],
        ])->assertOk();
        $this->getJson('/api/public/categories', $this->tamil())->assertJsonPath('data.0.name', 'Car');
    }

    public function test_updating_without_translations_keeps_the_existing_tamil_text(): void
    {
        $id = $this->admin()->postJson('/api/platform/categories', [
            'name' => 'Van', 'slug' => 'van', 'translations' => ['ta' => ['name' => 'வேன்']],
        ])->json('data.id');

        $this->admin()->putJson("/api/platform/categories/{$id}", ['name' => 'Vans', 'slug' => 'van'])->assertOk();

        $this->getJson('/api/public/categories', $this->tamil())->assertJsonPath('data.0.name', 'வேன்');
        $this->getJson('/api/public/categories')->assertJsonPath('data.0.name', 'Vans');
    }

    public function test_translation_input_is_validated_and_unknown_languages_are_ignored(): void
    {
        $this->admin()->postJson('/api/platform/categories', [
            'name' => 'Bus', 'slug' => 'bus', 'translations' => ['ta' => ['name' => str_repeat('அ', 256)]],
        ])->assertStatus(422)->assertJsonValidationErrors('translations.ta.name');

        $id = $this->admin()->postJson('/api/platform/categories', [
            'name' => 'Bus', 'slug' => 'bus', 'translations' => ['ta' => ['name' => 'பேருந்து'], 'fr' => ['name' => 'Autobus']],
        ])->assertCreated()->json('data.id');

        $this->assertSame(['ta' => ['name' => 'பேருந்து']], VehicleCategory::findOrFail($id)->translations);
    }

    // ── Help items, hero slides, branding ──────────────────────────────

    public function test_faq_and_rich_terms_flow_to_the_public_help_endpoint(): void
    {
        $this->admin()->postJson('/api/platform/help-items', [
            'type' => 'faq', 'section' => 'Booking', 'title' => 'How do I book?', 'body' => 'Pick your dates.',
            'translations' => ['ta' => ['section' => 'முன்பதிவு', 'title' => 'எப்படி முன்பதிவு செய்வது?', 'body' => '']],
        ])->assertCreated();

        $this->admin()->postJson('/api/platform/help-items', [
            'type' => 'terms', 'title' => 'Payments', 'body' => '<p>Pay the shop.</p>',
            'translations' => ['ta' => ['title' => 'கட்டணங்கள்', 'body' => '<p>கடைக்குச் செலுத்துங்கள்.</p><script>alert(1)</script>']],
        ])->assertCreated();

        $items = collect($this->getJson('/api/public/help-items', $this->tamil())->assertOk()->json('data'));

        $faq = $items->where('type', 'faq')->firstWhere('title', 'எப்படி முன்பதிவு செய்வது?');
        $this->assertNotNull($faq, 'Tamil FAQ question is served');
        $this->assertSame('முன்பதிவு', $faq['section']);
        $this->assertSame('Pick your dates.', $faq['body'], 'empty Tamil answer falls back to English');
        $this->assertArrayNotHasKey('translations', $faq);

        $terms = $items->where('type', 'terms')->firstWhere('title', 'கட்டணங்கள்');
        $this->assertStringContainsString('கடைக்குச் செலுத்துங்கள்.', $terms['body']);
        $this->assertStringNotContainsString('<script', $terms['body'], 'Tamil rich text is sanitized like English');

        $english = collect($this->getJson('/api/public/help-items')->json('data'));
        $this->assertNotNull($english->firstWhere('title', 'How do I book?'));
    }

    public function test_hero_slide_tamil_text_from_a_multipart_form(): void
    {
        $this->admin()->post('/api/platform/hero-slides', [
            'title' => 'Explore the hill country', 'subtitle' => 'SUVs for Ella',
            'image' => UploadedFile::fake()->image('hero.jpg', 1600, 700),
            'link_url' => '/rent', 'link_label' => 'See SUVs', 'is_active' => '1',
            // The admin form sends translations[ta][title] etc. in FormData.
            'translations' => ['ta' => ['title' => 'மலைநாட்டைச் சுற்றிப் பாருங்கள்', 'subtitle' => '', 'link_label' => 'SUV களைப் பார்']],
        ])->assertCreated();

        $this->getJson('/api/public/hero-slides', $this->tamil())
            ->assertJsonPath('data.0.title', 'மலைநாட்டைச் சுற்றிப் பாருங்கள்')
            ->assertJsonPath('data.0.subtitle', 'SUVs for Ella')
            ->assertJsonPath('data.0.link_label', 'SUV களைப் பார்');

        $this->getJson('/api/public/hero-slides')->assertJsonPath('data.0.title', 'Explore the hill country');
    }

    public function test_branding_tagline_for_the_public_site_but_english_in_the_admin_form(): void
    {
        PlatformDetail::create(['name' => 'LankaLane', 'tagline' => 'Rent any vehicle.']);

        $this->admin()->post('/api/platform/details', [
            '_method' => 'PUT', 'name' => 'LankaLane', 'tagline' => 'Rent any vehicle.',
            'translations' => ['ta' => ['tagline' => 'எந்த வாகனத்தையும் வாடகைக்கு எடுங்கள்.']],
        ])->assertOk();

        $this->getJson('/api/platform-details', $this->tamil())->assertJsonPath('data.tagline', 'எந்த வாகனத்தையும் வாடகைக்கு எடுங்கள்.');
        $this->getJson('/api/platform-details')->assertJsonPath('data.tagline', 'Rent any vehicle.');
        $this->admin()->getJson('/api/platform/details')
            ->assertJsonPath('data.tagline', 'Rent any vehicle.')
            ->assertJsonPath('data.translations.ta.tagline', 'எந்த வாகனத்தையும் வாடகைக்கு எடுங்கள்.');
    }

    // ── Customer-facing messages ───────────────────────────────────────

    public function test_customer_login_errors_in_tamil_and_english(): void
    {
        $this->postJson('/api/customer/login', [], $this->tamil())
            ->assertStatus(422)
            ->assertJsonPath('message', 'சரிபார்ப்பு தோல்வியடைந்தது')
            ->assertJsonPath('errors.email.0', 'மின்னஞ்சல் தேவை.');

        $this->postJson('/api/customer/login', ['email' => 'nobody@example.com', 'password' => 'wrong-pass-1'], $this->tamil())
            ->assertJsonPath('errors.email.0', 'வழங்கப்பட்ட உள்நுழைவு விவரங்கள் தவறானவை.');

        $this->postJson('/api/customer/login', [])
            ->assertJsonPath('message', 'Validation failed')
            ->assertJsonPath('errors.email.0', 'The email field is required.');
    }

    public function test_booking_rule_errors_reach_the_customer_in_tamil(): void
    {
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = $this->publishedVehicle($category, ['min_rental_days' => 3]);
        $token = Customer::factory()->create()->createToken('c')->plainTextToken;

        $booking = fn (array $headers) => $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'vehicle_id' => $vehicle->id,
            'pickup_at' => now()->addDays(5)->setTime(10, 0)->toIso8601String(),
            'return_at' => now()->addDays(6)->setTime(10, 0)->toIso8601String(),
        ], $headers);

        $booking($this->tamil())->assertStatus(422)->assertJsonPath('errors.return_at.0', 'குறைந்தபட்ச வாடகைக் காலம் 3 நாள்(கள்).');
        $booking(['Accept' => 'application/json'])->assertJsonPath('errors.return_at.0', 'Minimum rental is 3 day(s).');
    }

    public function test_only_supported_locales_are_used(): void
    {
        $this->getJson('/api/public/categories', ['X-Locale' => 'fr', 'Accept' => 'application/json'])
            ->assertOk()->assertHeader('Content-Language', 'en');

        // A browser's own Accept-Language never switches the API (the vendor/platform panels rely on that).
        $this->getJson('/api/public/categories', ['Accept-Language' => 'ta-LK,ta;q=0.9', 'Accept' => 'application/json'])
            ->assertHeader('Content-Language', 'en');
    }
}
