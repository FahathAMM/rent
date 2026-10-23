<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\SystemAdmin;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_user_bearer_token_is_rejected_by_platform_routes(): void
    {
        $this->seed(MenuSeeder::class);
        $company = Company::factory()->create();
        $user = User::factory()->forCompany($company)->role('owner')->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/platform/dashboard')
            ->assertUnauthorized();
    }

    public function test_platform_admin_bearer_token_is_rejected_by_company_routes(): void
    {
        $admin = SystemAdmin::factory()->create();
        $token = $admin->createToken('t')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard')
            ->assertUnauthorized();
    }

    public function test_company_user_cannot_list_platform_companies(): void
    {
        $this->seed(MenuSeeder::class);
        $superAdmin = User::factory()->role('super-admin')->create();

        // Even the legacy tenant "super-admin" role has no bearing on the
        // platform guard — it's a users-table role, not a SystemAdmin.
        $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/platform/companies')
            ->assertUnauthorized();
    }

    public function test_inactive_platform_admin_is_denied(): void
    {
        $admin = SystemAdmin::factory()->inactive()->create();

        $this->actingAs($admin, 'platform')
            ->getJson('/api/platform/dashboard')
            ->assertForbidden();
    }

    public function test_platform_admin_role_cannot_manage_other_admins(): void
    {
        $admin = SystemAdmin::factory()->create(); // platform_admin, not owner

        $this->actingAs($admin, 'platform')
            ->postJson('/api/platform/users', [
                'name' => 'New Admin', 'email' => 'new@platform.test',
                'password' => 'password123', 'role' => 'platform_admin',
            ])
            ->assertForbidden();
    }

    public function test_platform_owner_can_manage_other_admins(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->actingAs($owner, 'platform')
            ->postJson('/api/platform/users', [
                'name' => 'New Admin', 'email' => 'new@platform.test',
                'password' => 'password123', 'role' => 'platform_admin',
            ])
            ->assertCreated();
    }

    public function test_platform_owner_can_update_another_admin_keeping_their_own_email(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $target = SystemAdmin::factory()->create(['email' => 'target@platform.test']);

        $this->actingAs($owner, 'platform')
            ->putJson("/api/platform/users/{$target->id}", [
                'name' => 'Renamed Admin',
                'email' => 'target@platform.test',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Admin');
    }

    public function test_platform_owner_cannot_delete_their_own_account(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->actingAs($owner, 'platform')
            ->deleteJson("/api/platform/users/{$owner->id}")
            ->assertForbidden();
    }
}
