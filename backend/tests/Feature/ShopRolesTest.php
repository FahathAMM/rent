<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Role;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Roles a shop owner creates for their own shop, and staff holding them. */
class ShopRolesTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole('owner');
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function createRole(array $overrides = [])
    {
        return $this->as($this->owner)->postJson('/api/vendor/roles', $overrides + [
            'name' => 'Driver',
            'permissions' => ['vendor-dashboard-view', 'vendor-vehicles-bookings-view', 'vendor-vehicles-bookings-edit'],
        ]);
    }

    private function staffWithRole(int $roleId): User
    {
        $this->as($this->owner)->postJson('/api/vendor/staff', [
            'name' => 'Nimal', 'email' => 'nimal@example.com', 'password' => 'secret123', 'role_id' => $roleId,
        ])->assertCreated()->assertJsonPath('data.role', 'member')->assertJsonPath('data.role_label', 'Driver');

        return User::where('email', 'nimal@example.com')->firstOrFail();
    }

    public function test_owner_creates_a_role_and_staff_get_exactly_its_permissions(): void
    {
        $roleId = $this->createRole()->assertCreated()->assertJsonPath('data.name', 'Driver')->json('data.id');
        $staff = $this->staffWithRole($roleId);

        $this->assertSame(['Driver'], $staff->getRoleNames()->all(), 'exactly one shop role');
        $this->assertTrue($staff->hasVendorPermission('vendor-vehicles-bookings-edit'));
        $this->assertFalse($staff->hasVendorPermission('vendor-vehicles-list-view'));

        // Route `can:` middleware and policies both follow the role.
        $this->as($staff)->getJson('/api/vendor/bookings')->assertOk();
        $this->as($staff)->getJson('/api/vehicles')->assertForbidden();

        // /auth/me tells the frontend what to show.
        $this->as($staff)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.shop.role', 'member')
            ->assertJsonPath('data.shop.role_label', 'Driver')
            ->assertJsonFragment(['vendor-vehicles-bookings-edit']);

        // The navigation menu shows only what the role allows.
        $menu = collect($this->as($staff)->getJson('/api/menus/navigation?audience=vendor')->assertOk()->json('data'))
            ->flatMap(fn ($m) => array_merge([$m['route_name'] ?? null], array_column($m['children'] ?? [], 'route_name')))->filter();
        $this->assertContains('/vendor/bookings', $menu->all());
        $this->assertNotContains('/vendor/vehicles', $menu->all());
    }

    public function test_editing_a_role_changes_its_members_access_immediately(): void
    {
        $roleId = $this->createRole()->json('data.id');
        $staff = $this->staffWithRole($roleId);

        $this->as($this->owner)->putJson("/api/vendor/roles/{$roleId}", [
            'name' => 'Driver', 'permissions' => ['vendor-dashboard-view', 'vendor-vehicles-list-view'],
        ])->assertOk();

        $this->as($staff)->getJson('/api/vehicles')->assertOk();
        $this->as($staff)->getJson('/api/vendor/bookings')->assertForbidden();
    }

    public function test_owner_only_permissions_cannot_be_given_to_a_role(): void
    {
        foreach (['vendor-staff-create', 'vendor-roles-edit', 'vendor-finance-bank_details-edit', 'customer-dashboard-view'] as $permission) {
            $this->createRole(['name' => "Bad {$permission}", 'permissions' => [$permission]])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('permissions.0');
        }

        $this->as($this->owner)->getJson('/api/vendor/roles/permissions')
            ->assertOk()
            ->assertJsonMissing(['vendor-staff-create'])
            ->assertJsonMissing(['vendor-roles-view'])
            ->assertJsonFragment(['vendor-vehicles-list-view']);
    }

    public function test_platform_role_names_are_reserved_and_names_are_unique_per_shop(): void
    {
        $this->createRole(['name' => 'owner'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->createRole(['name' => 'shop-owner'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->createRole()->assertCreated();
        $this->createRole()->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_only_the_shop_owner_can_manage_roles(): void
    {
        // even a role with every assignable permission can't manage roles
        $manager = User::factory()->memberOf($this->shop, ['vendor-dashboard-view', 'vendor-vehicles-list-view'])->create();

        $this->as($manager)->getJson('/api/vendor/roles')->assertForbidden();
        $this->as($manager)->postJson('/api/vendor/roles', ['name' => 'X', 'permissions' => []])->assertForbidden();
    }

    public function test_the_shop_owner_role_is_not_listed_or_editable(): void
    {
        $ownerRole = Role::ofShop($this->shop->id)->where('name', Role::SHOP_OWNER)->firstOrFail();

        $this->as($this->owner)->getJson('/api/vendor/roles')->assertOk()->assertJsonMissing(['name' => Role::SHOP_OWNER]);
        $this->as($this->owner)->putJson("/api/vendor/roles/{$ownerRole->id}", ['name' => 'X', 'permissions' => []])->assertNotFound();
        $this->as($this->owner)->deleteJson("/api/vendor/roles/{$ownerRole->id}")->assertNotFound();
    }

    public function test_a_shops_roles_are_private_to_it(): void
    {
        $roleId = $this->createRole()->json('data.id');

        $otherOwner = User::factory()->create();
        $otherShop = RentalShop::factory()->create(['owner_user_id' => $otherOwner->id]);
        $otherOwner->update(['shop_id' => $otherShop->id]);
        $otherOwner->setShopRole('owner');

        $this->as($otherOwner)->getJson('/api/vendor/roles')->assertOk()->assertJsonMissing(['name' => 'Driver']);
        $this->as($otherOwner)->putJson("/api/vendor/roles/{$roleId}", ['name' => 'Hijack', 'permissions' => []])->assertNotFound();
        $this->as($otherOwner)->postJson('/api/vendor/staff', [
            'name' => 'X', 'email' => 'x@example.com', 'password' => 'secret123', 'role_id' => $roleId,
        ])->assertUnprocessable()->assertJsonValidationErrors('role_id');
    }

    public function test_a_role_in_use_cannot_be_deleted_until_its_staff_move(): void
    {
        $roleId = $this->createRole()->json('data.id');
        $staff = $this->staffWithRole($roleId);

        $this->as($this->owner)->deleteJson("/api/vendor/roles/{$roleId}")->assertStatus(422);

        $staffRole = Role::find($this->createRole(['name' => 'Staff', 'permissions' => ['vendor-dashboard-view']])->json('data.id'));
        $this->as($this->owner)->putJson("/api/vendor/staff/{$staff->id}", ['role_id' => $staffRole->id])->assertOk()->assertJsonPath('data.role_label', 'Staff');
        $this->assertTrue($staff->fresh()->hasRole($staffRole));

        $this->as($this->owner)->deleteJson("/api/vendor/roles/{$roleId}")->assertOk();
        $this->assertDatabaseMissing('roles', ['id' => $roleId]);
    }
}
