<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\PublicVisit;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/** Public page visits: daily log file + public_visits table, listed on /platform/visits. */
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
