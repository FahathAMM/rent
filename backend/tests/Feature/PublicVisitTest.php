<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\PublicVisit;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/** Public and vendor app page visits: daily log file + public_visits table, listed on /platform/visits. */
class PublicVisitTest extends TestCase
{
    use RefreshDatabase;

    private string $logDir;

    protected function setUp(): void
    {
        parent::setUp();
        // Keep test visits out of the real storage/logs/public_visit files.
        $this->logDir = sys_get_temp_dir() . '/public-visit-test-' . uniqid();
        config(['logging.public_visit_path' => $this->logDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->logDir);
        parent::tearDown();
    }

    private function asAdmin()
    {
        return $this->withHeader('Authorization', 'Bearer ' . SystemAdmin::factory()->create()->createToken('t')->plainTextToken);
    }

    public function test_only_public_page_visits_are_saved_to_the_database(): void
    {
        $this->postJson('/api/visits', ['type' => 'public_visit', 'path' => '/browse'])->assertOk();
        $this->postJson('/api/visits', ['type' => 'site_visit', 'path' => '/login'])->assertOk();

        $this->assertSame(['/browse'], PublicVisit::pluck('path')->all());

        $file = $this->logDir . '/' . now()->toDateString() . '.log';
        $this->assertFileExists($file);
        $this->assertStringContainsString('site_visit | path: /login', File::get($file), 'every type still goes to the daily file');
    }

    public function test_a_signed_in_customer_is_recorded_on_the_visit(): void
    {
        $customer = Customer::factory()->create(['name' => 'Nimal Perera']);
        $token = $customer->createToken('t')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/visits', ['type' => 'public_visit', 'path' => '/browse'])->assertOk();

        $visit = PublicVisit::sole();
        $this->assertSame($customer->id, $visit->customer_id);
        $this->assertSame('Nimal Perera', $visit->customer_name);

        $file = $this->logDir . '/' . now()->toDateString() . '.log';
        $this->assertStringContainsString("customer_id: {$customer->id} | customer_name: Nimal Perera", File::get($file));
    }

    public function test_a_guest_or_a_vendor_token_leaves_the_customer_blank(): void
    {
        $this->postJson('/api/visits', ['type' => 'public_visit', 'path' => '/browse'])->assertOk();

        $vendorToken = User::factory()->create()->createToken('t')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$vendorToken}")
            ->postJson('/api/visits', ['type' => 'public_visit', 'path' => '/shops'])->assertOk();

        $this->assertSame([null, null], PublicVisit::pluck('customer_id')->all());
        $this->assertSame([null, null], PublicVisit::pluck('customer_name')->all());
    }

    public function test_a_vendor_app_visit_records_the_signed_in_member_and_their_shop(): void
    {
        $owner = User::factory()->create(['name' => 'Kamal Silva']);
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id, 'name' => 'Kandy Rentals']);
        $owner->update(['shop_id' => $shop->id]);
        $token = $owner->createToken('t')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/visits', ['type' => 'vendor_visit', 'path' => '/vendor/bookings'])->assertOk();

        $visit = PublicVisit::sole();
        $this->assertSame('vendor_visit', $visit->type);
        $this->assertSame('/vendor/bookings', $visit->path);
        $this->assertSame($owner->id, $visit->user_id);
        $this->assertSame('Kamal Silva', $visit->user_name);
        $this->assertSame($shop->id, $visit->shop_id);
        $this->assertSame('Kandy Rentals', $visit->shop_name);
        $this->assertNull($visit->customer_id);

        $file = $this->logDir . '/' . now()->toDateString() . '.log';
        $this->assertStringContainsString(
            "vendor_visit | path: /vendor/bookings | customer_id: - | customer_name: - | user_id: {$owner->id} | user_name: Kamal Silva | shop_id: {$shop->id} | shop_name: Kandy Rentals",
            File::get($file)
        );
    }

    public function test_a_public_visit_defaults_to_the_public_type(): void
    {
        $this->postJson('/api/visits', ['path' => '/browse'])->assertOk();

        $this->assertSame('public_visit', PublicVisit::sole()->type);
    }

    public function test_the_type_filter_narrows_the_list_and_the_summary(): void
    {
        PublicVisit::create(['type' => 'public_visit', 'path' => '/browse', 'ip' => '1.1.1.1']);
        PublicVisit::create(['type' => 'vendor_visit', 'path' => '/vendor/dashboard', 'ip' => '2.2.2.2', 'user_name' => 'Kamal Silva', 'shop_name' => 'Kandy Rentals']);
        PublicVisit::create(['type' => 'vendor_visit', 'path' => '/vendor/bookings', 'ip' => '2.2.2.2']);

        $this->asAdmin()->getJson('/api/platform/visits?type=vendor_visit')
            ->assertOk()
            ->assertJsonPath('record.total', 2)
            ->assertJsonPath('record.data.0.type', 'vendor_visit');

        $this->asAdmin()->getJson('/api/platform/visits?type=public_visit')
            ->assertOk()
            ->assertJsonPath('record.total', 1)
            ->assertJsonPath('record.data.0.path', '/browse');

        // No type (or an unknown one) means every visit.
        $this->asAdmin()->getJson('/api/platform/visits')->assertOk()->assertJsonPath('record.total', 3);
        $this->asAdmin()->getJson('/api/platform/visits?type=bogus')->assertOk()->assertJsonPath('record.total', 3);

        // Search also finds the vendor's name and shop.
        $this->asAdmin()->getJson('/api/platform/visits?search=Kandy')->assertOk()->assertJsonPath('record.total', 1);

        $this->asAdmin()->getJson('/api/platform/visits/summary?type=vendor_visit')
            ->assertOk()
            ->assertJsonPath('data.today', 2)
            ->assertJsonPath('data.unique_today', 1)
            ->assertJsonCount(2, 'data.top_pages');

        $this->asAdmin()->getJson('/api/platform/visits/summary')
            ->assertOk()
            ->assertJsonPath('data.today', 3)
            // Top pages are also split by source, whatever the type filter.
            ->assertJsonCount(1, 'data.top_pages_by_type.public_visit')
            ->assertJsonPath('data.top_pages_by_type.public_visit.0.path', '/browse')
            ->assertJsonCount(2, 'data.top_pages_by_type.vendor_visit');
    }

    public function test_platform_admins_see_the_visits_and_a_summary(): void
    {
        PublicVisit::create(['path' => '/browse', 'ip' => '1.1.1.1']);
        PublicVisit::create(['path' => '/browse', 'ip' => '1.1.1.1']);
        PublicVisit::create(['path' => '/shops', 'ip' => '2.2.2.2']);

        $this->asAdmin()->getJson('/api/platform/visits/summary')
            ->assertOk()
            ->assertJsonPath('data.today', 3)
            ->assertJsonPath('data.unique_today', 2)
            ->assertJsonPath('data.top_pages.0.path', '/browse')
            ->assertJsonPath('data.top_pages.0.visits', 2);

        $this->asAdmin()->getJson('/api/platform/visits?search=shops')
            ->assertOk()
            ->assertJsonPath('record.total', 1)
            ->assertJsonPath('record.data.0.path', '/shops');
    }

    public function test_visits_are_platform_only(): void
    {
        $this->getJson('/api/platform/visits')->assertUnauthorized();
    }
}
