<?php

namespace Tests\Feature;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\Company;
use App\Models\SystemAdmin;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Only the audit-log half of this test class survives the CRM/Invoicing/
 * Accounting cleanup: Platform\ActivityController (out of scope for this
 * cleanup — see the repo-wide "do not touch Platform/**" rule) still
 * queries App\Models\Activity and the `activities` table, both of which
 * were removed along with the CRM module they served. Its global activity
 * feed is therefore left non-functional pending a follow-up that either
 * rebuilds it against EAM data or retires the feature.
 */
class PlatformActivityAndAuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected SystemAdmin $admin;
    protected Company $companyA;
    protected Company $companyB;
    protected User $userA;
    protected User $userB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->admin = SystemAdmin::factory()->create();
        $this->companyA = Company::factory()->create(['name' => 'Alpha Trading']);
        $this->companyB = Company::factory()->create(['name' => 'Beta Services']);
        $this->userA = User::factory()->forCompany($this->companyA)->role('owner')->create(['name' => 'Ahmed']);
        $this->userB = User::factory()->forCompany($this->companyB)->role('owner')->create(['name' => 'Sara']);

        AuditLog::create([
            'company_id' => $this->companyA->id, 'user_id' => $this->userA->id,
            'action' => 'create', 'form' => 'Company', 'record' => 'Alpha Trading',
        ]);
        AuditLog::create([
            'company_id' => $this->companyB->id, 'user_id' => $this->userB->id,
            'action' => 'update', 'form' => 'Company', 'record' => 'Beta Services',
        ]);
    }

    public function test_platform_admin_sees_global_audit_logs_across_every_company(): void
    {
        $response = $this->actingAs($this->admin, 'platform')->getJson('/api/platform/audit-logs')->assertOk();

        $records = collect($response->json('record.data'))->pluck('record')->all();

        $this->assertContains('Alpha Trading', $records);
        $this->assertContains('Beta Services', $records);
    }

    public function test_platform_admin_can_filter_audit_logs_by_company_and_event(): void
    {
        $response = $this->actingAs($this->admin, 'platform')
            ->getJson("/api/platform/audit-logs?company_id={$this->companyB->id}&event=update")
            ->assertOk();

        $records = collect($response->json('record.data'))->pluck('record')->all();

        $this->assertEquals(['Beta Services'], $records);
    }
}
