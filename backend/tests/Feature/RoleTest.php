<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\CompanySetting;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $ownerA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->superAdmin = User::factory()->role('super-admin')->create();

        $company = Company::factory()->create();
        CompanySetting::factory()->for($company)->create();
        $this->ownerA = User::factory()->forCompany($company)->role('owner')->create();
    }

    public function test_super_admin_can_create_a_role_with_permissions(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/roles', ['name' => 'auditor', 'permissions' => ['dashboard-view']])
            ->assertCreated();

        $response->assertJsonPath('data.name', 'auditor');
        $response->assertJsonPath('data.permissions.0', 'dashboard-view');
        $this->assertDatabaseHas('roles', ['name' => 'auditor']);
    }

    public function test_role_name_must_be_unique(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/roles', ['name' => 'owner'])
            ->assertStatus(422);
    }

    public function test_super_admin_can_update_a_roles_permissions(): void
    {
        $role = Role::create(['name' => 'auditor', 'guard_name' => 'web']);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->putJson("/api/roles/{$role->id}", ['permissions' => ['dashboard-view', 'admin-company-view']])
            ->assertOk();

        $response->assertJsonCount(2, 'data.permissions');
    }

    public function test_system_roles_cannot_be_deleted(): void
    {
        $ownerRole = Role::where('name', 'owner')->firstOrFail();

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->deleteJson("/api/roles/{$ownerRole->id}")
            ->assertStatus(422);

        $response->assertJsonPath('message', 'System roles cannot be deleted.');
        $this->assertDatabaseHas('roles', ['id' => $ownerRole->id]);
    }

    public function test_a_custom_role_can_be_deleted(): void
    {
        $role = Role::create(['name' => 'auditor', 'guard_name' => 'web']);

        $this->actingAs($this->superAdmin, 'sanctum')
            ->deleteJson("/api/roles/{$role->id}")
            ->assertOk();

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
    }

    public function test_a_tenant_owner_cannot_manage_roles(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')->getJson('/api/roles')->assertForbidden();
        $this->actingAs($this->ownerA, 'sanctum')->postJson('/api/roles', ['name' => 'hacker'])->assertForbidden();
    }
}
