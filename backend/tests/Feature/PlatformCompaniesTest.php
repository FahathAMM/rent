<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\SystemAdmin;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformCompaniesTest extends TestCase
{
    use RefreshDatabase;

    protected SystemAdmin $admin;
    protected Company $companyA;
    protected Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->admin = SystemAdmin::factory()->owner()->create();
        $this->companyA = Company::factory()->create(['name' => 'Alpha Trading']);
        $this->companyB = Company::factory()->create(['name' => 'Beta Services', 'status' => 'suspended']);

        User::factory()->forCompany($this->companyA)->role('owner')->create();
        User::factory()->forCompany($this->companyB)->role('owner')->create();
    }

    public function test_platform_admin_can_list_every_company(): void
    {
        $response = $this->actingAs($this->admin, 'platform')->getJson('/api/platform/companies')->assertOk();

        $names = collect($response->json('record.data'))->pluck('name')->all();

        $this->assertContains('Alpha Trading', $names);
        $this->assertContains('Beta Services', $names);
    }

    public function test_platform_admin_can_filter_companies_by_status(): void
    {
        $response = $this->actingAs($this->admin, 'platform')
            ->getJson('/api/platform/companies?status=suspended')
            ->assertOk();

        $names = collect($response->json('record.data'))->pluck('name')->all();

        $this->assertEquals(['Beta Services'], $names);
    }

    public function test_platform_admin_can_view_company_detail_with_stats_and_users(): void
    {
        $response = $this->actingAs($this->admin, 'platform')
            ->getJson("/api/platform/companies/{$this->companyA->id}")
            ->assertOk();

        $response->assertJsonPath('data.company.id', $this->companyA->id)
            ->assertJsonStructure(['data' => ['company', 'users', 'recent_audit_logs']]);
    }

    public function test_platform_admin_can_suspend_and_activate_a_company(): void
    {
        $this->actingAs($this->admin, 'platform')
            ->postJson("/api/platform/companies/{$this->companyA->id}/suspend")
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertDatabaseHas('companies', ['id' => $this->companyA->id, 'status' => 'suspended']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'suspend', 'company_id' => $this->companyA->id, 'system_admin_id' => $this->admin->id]);

        $this->actingAs($this->admin, 'platform')
            ->postJson("/api/platform/companies/{$this->companyA->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }
}
