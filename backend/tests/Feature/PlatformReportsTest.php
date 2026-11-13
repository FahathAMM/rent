<?php

namespace Tests\Feature;

use App\Models\PlatformExpense;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use App\Services\PlatformReportService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** /platform/reports — every report builds on demo data; the money ones are Platform Owner only. */
class PlatformReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    public function test_every_report_builds_and_exports_for_the_owner(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        foreach (PlatformReportService::REPORTS as $slug => $meta) {
            $res = $this->as($owner)->getJson("/api/platform/reports/{$slug}");
            $this->assertSame(200, $res->status(), "{$slug}: " . $res->getContent());
            $res->assertJsonPath('data.title', $meta['title'])->assertJsonPath('data.dated', $meta['dated'])
                ->assertJsonStructure(['data' => ['summary', 'columns', 'rows', 'from', 'to']]);

            // Every row has exactly the report's columns, so the table and the exports line up.
            $keys = array_column($res->json('data.columns'), 'key');
            foreach (array_slice($res->json('data.rows'), 0, 3) as $row) {
                $this->assertEqualsCanonicalizing($keys, array_keys($row), "{$slug} row keys");
            }

            $csv = $this->as($owner)->get("/api/platform/reports/{$slug}/export?format=csv");
            $this->assertSame(200, $csv->status(), "{$slug} csv");
            $this->assertStringContainsString($res->json('data.columns.0.label'), $csv->getContent());
        }

        $this->as($owner)->get('/api/platform/reports/shop-register/export?format=pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->as($owner)->getJson('/api/platform/reports/nonsense')->assertNotFound();
    }

    public function test_money_reports_are_for_the_platform_owner_only(): void
    {
        $admin = SystemAdmin::factory()->create();

        foreach (PlatformReportService::REPORTS as $slug => $meta) {
            $status = $this->as($admin)->getJson("/api/platform/reports/{$slug}")->status();
            $this->assertSame($meta['owner_only'] ? 403 : 200, $status, $slug);
        }
        $this->as($admin)->get('/api/platform/reports/income-statement/export?format=csv')->assertForbidden();

        $slugs = fn ($res) => collect($res->json('data'))->flatMap(fn ($g) => array_column($g['reports'], 'slug'));
        $forAdmin = $slugs($this->as($admin)->getJson('/api/platform/reports')->assertOk());
        $this->assertNotContains('income-statement', $forAdmin);
        $this->assertContains('shop-register', $forAdmin);

        $forOwner = $slugs($this->as(SystemAdmin::factory()->owner()->create())->getJson('/api/platform/reports')->assertOk());
        $this->assertEqualsCanonicalizing(array_keys(PlatformReportService::REPORTS), $forOwner->all());
    }

    public function test_the_income_statement_adds_up(): void
    {
        $shop = RentalShop::firstOrFail();
        $from = now()->addYears(5)->startOfYear(); // a year the demo data never reaches
        $day = $from->copy()->addDays(40);

        SubscriptionPayment::create([
            'reference_no' => 'SUB-RPT-1', 'shop_id' => $shop->id, 'plan_id' => SubscriptionPlan::where('code', 'pro')->value('id'),
            'periods' => 1, 'amount' => 2500, 'status' => SubscriptionPayment::STATUS_APPROVED, 'reviewed_at' => $day,
        ]);
        Promotion::create([
            'reference_no' => 'PRM-RPT-1', 'shop_id' => $shop->id, 'type' => Promotion::TYPE_SPONSORED, 'city' => 'Kandy', 'days' => 7,
            'amount' => 8000, 'kind' => Promotion::KIND_PAID, 'status' => Promotion::STATUS_APPROVED, 'reviewed_at' => $day,
        ]);
        PlatformExpense::create(['expense_number' => 'PEX-RPT-1', 'expense_date' => $day->toDateString(), 'category' => 'hosting', 'amount' => 3000]);

        $owner = SystemAdmin::factory()->owner()->create();
        $range = "?from={$from->toDateString()}&to={$from->copy()->endOfYear()->toDateString()}";

        $res = $this->as($owner)->getJson("/api/platform/reports/income-statement{$range}")->assertOk();
        $this->assertCount(12, $res->json('data.rows'));
        $this->assertEquals([2500, 8000, 3000, 7500], array_column($res->json('data.summary'), 'value'));
        $this->assertEquals(7500, $res->json('data.rows.1.net')); // February

        $byShop = $this->as($owner)->getJson("/api/platform/reports/income-by-shop{$range}")->assertOk();
        $this->assertSame($shop->name, $byShop->json('data.rows.0.shop'));
        $this->assertEquals(10500, $byShop->json('data.rows.0.total'));
    }
}
