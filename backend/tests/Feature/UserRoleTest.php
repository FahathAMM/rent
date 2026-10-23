<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserRoleTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $adminRole = Role::create(['name' => 'admin', 'guard_name' => 'web']);
        Role::create(['name' => 'staff', 'guard_name' => 'web']);

        Permission::create(['name' => 'create products', 'guard_name' => 'web']);
        Permission::create(['name' => 'edit products',   'guard_name' => 'web']);
        Permission::create(['name' => 'view reports',    'guard_name' => 'web']);

        // UserController gates each action behind these, matching what
        // MenuSeeder grants the 'admin' role in production.
        $adminRole->givePermissionTo([
            Permission::create(['name' => 'admin-users-view',   'guard_name' => 'web']),
            Permission::create(['name' => 'admin-users-create', 'guard_name' => 'web']),
            Permission::create(['name' => 'admin-users-edit',   'guard_name' => 'web']),
            Permission::create(['name' => 'admin-users-delete', 'guard_name' => 'web']),
        ]);

        // Every tenant-scoped query (including the admin's own) is filtered
        // by company_id, so the admin — and every user it manages in these
        // tests — must belong to the same company.
        $this->company = Company::factory()->create();
        $this->admin = User::factory()->forCompany($this->company)->create(['is_active' => true]);
        $this->admin->syncRoles(['admin']);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_user_can_be_created_with_multiple_roles(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/users', [
                'name'     => 'Multi Role User',
                'email'    => 'multi@example.com',
                'password' => 'password123',
                'roles'    => ['admin', 'staff'],
            ]);

        $response->assertCreated();

        $roles = $response->json('data.roles');
        $this->assertCount(2, $roles);
        $this->assertContains('admin', $roles);
        $this->assertContains('staff', $roles);
    }

    public function test_user_can_be_created_with_no_roles(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/users', [
                'name'     => 'No Role User',
                'email'    => 'norole@example.com',
                'password' => 'password123',
            ]);

        $response->assertCreated();
        $this->assertEmpty($response->json('data.roles'));
    }

    public function test_user_can_be_created_with_single_role(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/users', [
                'name'     => 'Staff Only',
                'email'    => 'staffonly@example.com',
                'password' => 'password123',
                'roles'    => ['staff'],
            ]);

        $response->assertCreated();
        $roles = $response->json('data.roles');
        $this->assertCount(1, $roles);
        $this->assertContains('staff', $roles);
    }

    public function test_create_user_rejects_nonexistent_role(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/users', [
                'name'     => 'Bad Role User',
                'email'    => 'bad@example.com',
                'password' => 'password123',
                'roles'    => ['nonexistent_role'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('roles.0');
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_user_roles_can_be_updated_to_multiple(): void
    {
        $user = User::factory()->forCompany($this->company)->create();
        $user->syncRoles(['staff']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/users/{$user->id}", [
                'roles' => ['admin', 'staff'],
            ]);

        $response->assertOk();
        $roles = $response->json('data.roles');
        $this->assertCount(2, $roles);
        $this->assertContains('admin', $roles);
        $this->assertContains('staff', $roles);
    }

    public function test_user_roles_can_be_cleared(): void
    {
        $user = User::factory()->forCompany($this->company)->create();
        $user->syncRoles(['staff']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/users/{$user->id}", [
                'roles' => [],
            ]);

        $response->assertOk();
        $this->assertEmpty($response->json('data.roles'));
    }

    public function test_update_without_roles_key_preserves_existing_roles(): void
    {
        $user = User::factory()->forCompany($this->company)->create();
        $user->syncRoles(['staff']);

        // Update name only — roles key not sent
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/users/{$user->id}", ['name' => 'Updated Name'])
            ->assertOk();

        $this->assertCount(1, $user->fresh()->roles);
        $this->assertEquals('staff', $user->fresh()->roles->first()->name);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public function test_login_returns_all_roles_for_multi_role_user(): void
    {
        $user = User::factory()->create([
            'email'     => 'multilogin@example.com',
            'password'  => 'password123',
            'is_active' => true,
        ]);
        $user->syncRoles(['admin', 'staff']);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'multilogin@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $roles = $response->json('data.user.roles');
        $this->assertIsArray($roles);
        $this->assertCount(2, $roles);
        $this->assertContains('admin', $roles);
        $this->assertContains('staff', $roles);
    }

    public function test_login_returns_empty_roles_for_user_with_no_role(): void
    {
        User::factory()->create([
            'email'     => 'norolelogin@example.com',
            'password'  => 'password123',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'norolelogin@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $this->assertEmpty($response->json('data.user.roles'));
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    public function test_user_gets_combined_permissions_from_multiple_roles(): void
    {
        $adminRole = Role::findByName('admin', 'web');
        $staffRole = Role::findByName('staff', 'web');

        $adminRole->givePermissionTo('create products');
        $staffRole->givePermissionTo('edit products');

        $user = User::factory()->create();
        $user->syncRoles(['admin', 'staff']);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $this->assertTrue($user->hasPermissionTo('create products'));
        $this->assertTrue($user->hasPermissionTo('edit products'));
        $this->assertFalse($user->hasPermissionTo('view reports'));
    }

    public function test_login_response_includes_combined_permissions(): void
    {
        $adminRole = Role::findByName('admin', 'web');
        $staffRole = Role::findByName('staff', 'web');
        $adminRole->givePermissionTo('create products');
        $staffRole->givePermissionTo('edit products');

        User::factory()->create([
            'email'     => 'permlogin@example.com',
            'password'  => 'password123',
            'is_active' => true,
        ])->syncRoles(['admin', 'staff']);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'permlogin@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $perms = $response->json('data.user.permissions');
        $this->assertContains('create products', $perms);
        $this->assertContains('edit products', $perms);
    }

    // ── Guard ─────────────────────────────────────────────────────────────────

    public function test_user_without_admin_role_cannot_access_users_endpoint(): void
    {
        $staffUser = User::factory()->create(['is_active' => true]);
        $staffUser->syncRoles(['staff']);

        $this->actingAs($staffUser, 'sanctum')
            ->getJson('/api/users')
            ->assertForbidden();
    }

    public function test_admin_user_can_list_users(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonStructure(['record' => ['data'], 'message', 'status']);
    }
}
