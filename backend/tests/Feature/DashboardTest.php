<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Company;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_asset_kpis_are_scoped_to_the_authenticated_companies_data(): void
    {
        $this->seed(MenuSeeder::class);

        $companyA = Company::factory()->create();
        $ownerA = User::factory()->forCompany($companyA)->role('owner')->create();
        $categoryA = AssetCategory::create(['company_id' => $companyA->id, 'name' => 'Laptop']);
        Asset::create(['company_id' => $companyA->id, 'asset_code' => 'AST-A-1', 'asset_category_id' => $categoryA->id, 'status' => 'available']);
        Asset::create(['company_id' => $companyA->id, 'asset_code' => 'AST-A-2', 'asset_category_id' => $categoryA->id, 'status' => 'assigned']);

        // A second tenant's assets must never leak into company A's counts.
        $companyB = Company::factory()->create();
        $categoryB = AssetCategory::create(['company_id' => $companyB->id, 'name' => 'Monitor']);
        Asset::create(['company_id' => $companyB->id, 'asset_code' => 'AST-B-1', 'asset_category_id' => $categoryB->id, 'status' => 'available']);
        Asset::create(['company_id' => $companyB->id, 'asset_code' => 'AST-B-2', 'asset_category_id' => $categoryB->id, 'status' => 'available']);
        Asset::create(['company_id' => $companyB->id, 'asset_code' => 'AST-B-3', 'asset_category_id' => $categoryB->id, 'status' => 'lost']);

        $response = $this->actingAs($ownerA, 'sanctum')->getJson('/api/dashboard')->assertOk();

        $response->assertJsonPath('data.company_name', $companyA->name);
        $response->assertJsonPath('data.asset_kpis.total', 2);
        $response->assertJsonPath('data.asset_kpis.available', 1);
        $response->assertJsonPath('data.asset_kpis.assigned', 1);
        $response->assertJsonPath('data.asset_kpis.lost', 0);
        $response->assertJsonPath('data.category_breakdown.0.name', 'Laptop');
    }

    public function test_dashboard_includes_recent_audit_logs(): void
    {
        $this->seed(MenuSeeder::class);

        $company = Company::factory()->create();
        $owner = User::factory()->forCompany($company)->role('owner')->create();

        $response = $this->actingAs($owner, 'sanctum')->getJson('/api/dashboard')->assertOk();

        $response->assertJsonStructure(['data' => [
            'company_name',
            'asset_kpis' => ['total', 'assigned', 'available', 'under_repair', 'lost', 'damaged', 'retired', 'disposed'],
            'category_breakdown',
            'recent_audit_logs',
            'warranty_expiring',
            'pending_requests',
            'pending_returns',
        ]]);
    }
}
