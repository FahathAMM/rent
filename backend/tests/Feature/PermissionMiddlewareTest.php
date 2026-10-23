<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PermissionMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $adminRole      = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $staffRole      = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);

        Permission::firstOrCreate(['name' => 'admin-users-view', 'guard_name' => 'web']);
        $adminRole->givePermissionTo('admin-users-view');

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->syncRoles([$adminRole]);

        // Menus/roles/platform settings are shared across every tenant, so
        // only the platform super-admin (not a tenant admin) may write them.
        $this->superAdmin = User::factory()->create(['is_active' => true]);
        $this->superAdmin->syncRoles([$superAdminRole]);

        $this->staff = User::factory()->create(['is_active' => true]);
        $this->staff->syncRoles([$staffRole]);
    }

    // ── Tenant-admin routes gated by the `role:admin|owner` middleware ──────

    public function test_admin_can_list_users(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk();
    }

    public function test_admin_cannot_create_menu(): void
    {
        // Menus are platform-wide, not per-tenant — a company admin must not
        // be able to change navigation shared by every other company.
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/menus', ['name' => 'Test Menu', 'slug' => 'test_menu'])
            ->assertForbidden();
    }

    public function test_admin_cannot_write_platform_settings(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/settings/general', ['site_name' => 'New Name'])
            ->assertForbidden();
    }

    // ── Platform super-admin routes gated by the `role:super-admin` middleware ──

    public function test_super_admin_can_create_menu(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/menus', ['name' => 'Test Menu', 'slug' => 'test_menu'])
            ->assertCreated();
    }

    public function test_super_admin_can_write_platform_settings(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->putJson('/api/settings/general', ['site_name' => 'New Name'])
            ->assertOk();
    }

    public function test_staff_cannot_access_users_list(): void
    {
        $this->actingAs($this->staff, 'sanctum')
            ->getJson('/api/users')
            ->assertForbidden();
    }

    public function test_staff_cannot_create_menu(): void
    {
        $this->actingAs($this->staff, 'sanctum')
            ->postJson('/api/menus', ['name' => 'Test Menu', 'slug' => 'test_menu'])
            ->assertForbidden();
    }

    public function test_staff_cannot_write_settings(): void
    {
        $this->actingAs($this->staff, 'sanctum')
            ->putJson('/api/settings/general', ['site_name' => 'New Name'])
            ->assertForbidden();
    }

    // ── Everyone authenticated can read shared navigation/branding ──────────

    public function test_staff_can_read_settings(): void
    {
        $this->actingAs($this->staff, 'sanctum')
            ->getJson('/api/settings')
            ->assertOk();
    }

    public function test_staff_can_read_navigation_menu(): void
    {
        $this->actingAs($this->staff, 'sanctum')
            ->getJson('/api/menus/navigation')
            ->assertOk();
    }

    // ── Unauthenticated is rejected ──────────────────────────────────────────

    public function test_unauthenticated_cannot_list_users(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
    }
}
