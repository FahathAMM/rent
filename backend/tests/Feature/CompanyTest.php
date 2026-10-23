<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\CompanySetting;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyTest extends TestCase
{
    use RefreshDatabase;

    protected Company $companyA;
    protected User $ownerA;
    protected User $salesA;
    protected Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->companyA = Company::factory()->create(['name' => 'Original Name']);
        CompanySetting::factory()->for($this->companyA)->create();
        $this->ownerA = User::factory()->forCompany($this->companyA)->role('owner')->create();
        $this->salesA = User::factory()->forCompany($this->companyA)->role('sales')->create();

        $this->companyB = Company::factory()->create();
        CompanySetting::factory()->for($this->companyB)->create();
    }

    public function test_owner_can_view_and_update_their_own_company_profile(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->getJson('/api/company')
            ->assertOk()
            ->assertJsonPath('data.name', 'Original Name');

        $response = $this->actingAs($this->ownerA, 'sanctum')
            ->putJson('/api/company', ['name' => 'Renamed Co', 'currency' => 'AED'])
            ->assertOk();

        $response->assertJsonPath('data.name', 'Renamed Co');
        $this->assertDatabaseHas('companies', ['id' => $this->companyA->id, 'name' => 'Renamed Co']);
    }

    public function test_sales_role_cannot_view_or_update_company_profile(): void
    {
        $this->actingAs($this->salesA, 'sanctum')->getJson('/api/company')->assertForbidden();
        $this->actingAs($this->salesA, 'sanctum')->putJson('/api/company', ['name' => 'Hijacked'])->assertForbidden();
    }

    public function test_updating_company_never_touches_another_tenant(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->putJson('/api/company', ['name' => 'Renamed Co'])
            ->assertOk();

        $this->assertDatabaseHas('companies', ['id' => $this->companyB->id, 'name' => $this->companyB->name]);
    }
}
