<?php

namespace Tests\Feature;

use App\Models\RentalShop;
use App\Models\Role;
use App\Models\SystemAdmin;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** The platform's Roles & Permissions page (platform roles = customer): anyone can view, only the Platform Owner can change. */
class PlatformRolesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
    }

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function customerRole(): Role
    {
        return Role::findByName('customer', 'web');
    }

    public function test_admins_see_only_platform_roles_not_shop_roles(): void
    {
        Role::shopOwnerOf(RentalShop::factory()->create()->id);

        $this->as(SystemAdmin::factory()->create())->getJson('/api/platform/roles')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['name' => 'customer', 'audience' => 'customer', 'is_system' => true])
            ->assertJsonMissing(['name' => Role::SHOP_OWNER]);
    }

    public function test_permissions_are_grouped_by_page(): void
    {
        $groups = collect($this->as(SystemAdmin::factory()->create())->getJson('/api/platform/permissions')->assertOk()->json('data'));

        $vehicles = $groups->firstWhere('slug', 'vehicles-list');
        $this->assertSame('vendor', $vehicles['audience']);
        $this->assertSame('vendor-vehicles-list-view', $vehicles['permissions']['view']);
        $this->assertSame('vendor-vehicles-list-delete', $vehicles['permissions']['delete']);
        // every seeded permission belongs to a page — nothing left ungrouped
        $this->assertSame(Permission::count(), $groups->sum(fn ($g) => count($g['permissions'])));
    }

    public function test_a_platform_admin_cannot_change_roles(): void
    {
        $this->as(SystemAdmin::factory()->create())
            ->putJson("/api/platform/roles/{$this->customerRole()->id}", ['permissions' => []])
            ->assertForbidden();
    }

    public function test_the_platform_owner_changes_what_a_role_can_do(): void
    {
        $this->as(SystemAdmin::factory()->owner()->create())
            ->putJson("/api/platform/roles/{$this->customerRole()->id}", ['permissions' => ['customer-dashboard-view', 'customer-bookings-view']])
            ->assertOk()
            ->assertJsonPath('data.permissions', ['customer-dashboard-view', 'customer-bookings-view']);

        $this->assertFalse($this->customerRole()->fresh()->hasPermissionTo('customer-bookings-create'));
    }

    public function test_a_role_cannot_get_permissions_from_the_other_side_or_be_renamed(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->as($owner)->putJson("/api/platform/roles/{$this->customerRole()->id}", ['permissions' => ['customer-dashboard-view', 'vendor-dashboard-view']])
            ->assertUnprocessable()->assertJsonValidationErrors('permissions');

        $this->as($owner)->putJson("/api/platform/roles/{$this->customerRole()->id}", ['name' => 'buyer'])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_a_shop_role_cannot_be_changed_from_the_platform(): void
    {
        $shopOwner = Role::shopOwnerOf(RentalShop::factory()->create()->id);

        $this->as(SystemAdmin::factory()->owner()->create())
            ->putJson("/api/platform/roles/{$shopOwner->id}", ['permissions' => []])
            ->assertNotFound();
    }

    public function test_reseeding_keeps_role_changes(): void
    {
        $this->customerRole()->syncPermissions(['customer-dashboard-view']);

        $this->seed(MenuSeeder::class);

        $this->assertSame(['customer-dashboard-view'], $this->customerRole()->fresh()->permissions->pluck('name')->all());
    }
}
