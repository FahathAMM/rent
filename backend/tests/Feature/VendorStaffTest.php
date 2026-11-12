<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Role;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The shop owner creates staff logins (users rows linked to the shop) and can remove them. */
class VendorStaffTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;
    private Role $managerRole;
    private Role $staffRole;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class); // vendor permissions

        $this->owner = User::factory()->create();
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
        $this->owner->setShopRole(User::SHOP_ROLE_OWNER);

        // roles the owner created for their shop
        $this->managerRole = $this->shopRole($this->shop->id, 'Manager', ['vendor-dashboard-view', 'vendor-vehicles-list-view', 'vendor-vehicles-list-create', 'vendor-vehicles-list-edit']);
        $this->staffRole = $this->shopRole($this->shop->id, 'Staff', ['vendor-dashboard-view', 'vendor-vehicles-list-view', 'vendor-vehicles-list-edit']);
    }

    private function shopRole(int $shopId, string $name, array $permissions): Role
    {
        $role = Role::create(['name' => $name, 'guard_name' => 'web', 'shop_id' => $shopId]);
        $role->syncPermissions($permissions);

        return $role;
    }

    private function as(User $user)
    {
        // Guards cache the resolved user for the app's lifetime — forget them so each
        // request authenticates its own bearer token, like a real separate request.
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function addStaff(array $overrides = [])
    {
        return $this->as($this->owner)->postJson('/api/vendor/staff', $overrides + [
            'name' => 'Kasun Perera',
            'email' => 'kasun@example.com',
            'phone' => '0771234567',
            'password' => 'secret123',
            'role_id' => $this->staffRole->id,
        ]);
    }

    public function test_owner_creates_a_staff_login_that_can_use_the_vendor_panel(): void
    {
        $this->addStaff()
            ->assertCreated()
            ->assertJsonPath('data.role', 'member')
            ->assertJsonPath('data.role_label', 'Staff')
            ->assertJsonPath('data.user.email', 'kasun@example.com');

        $staff = User::where('email', 'kasun@example.com')->firstOrFail();
        $this->assertSame($this->shop->id, (int) $staff->shop_id);
        $this->assertTrue($staff->hasRole($this->staffRole));
        $this->assertTrue($staff->checkPermissionTo('vendor-vehicles-list-view'));
        $this->assertFalse($staff->checkPermissionTo('vendor-staff-create'), 'staff role must not manage staff');

        // They can sign in with the password the owner set, and land in this shop.
        $token = $this->postJson('/api/auth/login', ['email' => 'kasun@example.com', 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonPath('data.user.shop.shop_id', $this->shop->id)
            ->json('data.token');

        $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/vehicles')->assertOk();
    }

    public function test_an_email_that_already_has_an_account_is_rejected(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->addStaff(['email' => 'taken@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_name_and_password_are_required(): void
    {
        $this->as($this->owner)->postJson('/api/vendor/staff', ['email' => 'x@example.com', 'role_id' => $this->staffRole->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'password']);
    }

    public function test_staff_cannot_add_staff(): void
    {
        $this->addStaff()->assertCreated();
        $staff = User::where('email', 'kasun@example.com')->first();

        $this->as($staff)->postJson('/api/vendor/staff', [
            'name' => 'Other', 'email' => 'other@example.com', 'password' => 'secret123', 'role_id' => $this->staffRole->id,
        ])->assertForbidden();
    }

    public function test_resetting_a_password_signs_the_staff_member_out(): void
    {
        $this->addStaff()->assertCreated();
        $staff = User::where('email', 'kasun@example.com')->first();
        $staff->createToken('phone');

        $this->as($this->owner)->putJson("/api/vendor/staff/{$staff->id}", ['role_id' => $this->managerRole->id, 'password' => 'newpass123'])
            ->assertOk()
            ->assertJsonPath('data.role_label', 'Manager');

        $this->assertSame(0, $staff->tokens()->count());
        $this->postJson('/api/auth/login', ['email' => 'kasun@example.com', 'password' => 'newpass123'])->assertOk();
    }

    public function test_a_blank_password_on_edit_keeps_the_current_one(): void
    {
        $this->addStaff()->assertCreated();
        $staff = User::where('email', 'kasun@example.com')->first();

        $this->as($this->owner)->putJson("/api/vendor/staff/{$staff->id}", ['role_id' => $this->staffRole->id, 'name' => 'Kasun P', 'password' => ''])
            ->assertOk()
            ->assertJsonPath('data.user.name', 'Kasun P');

        $this->postJson('/api/auth/login', ['email' => 'kasun@example.com', 'password' => 'secret123'])->assertOk();
    }

    public function test_the_shop_owner_role_can_do_everything(): void
    {
        $all = \Spatie\Permission\Models\Permission::where('name', 'like', 'vendor-%')->pluck('name');

        $this->assertNotEmpty($all);
        $this->assertTrue($all->every(fn ($p) => $this->owner->hasVendorPermission($p) && $this->owner->can($p)));
    }

    public function test_changing_the_role_swaps_the_permission_role(): void
    {
        $this->addStaff()->assertCreated();
        $staff = User::where('email', 'kasun@example.com')->first();
        $this->assertFalse($staff->checkPermissionTo('vendor-vehicles-list-create'));

        $this->as($this->owner)->putJson("/api/vendor/staff/{$staff->id}", ['role_id' => $this->managerRole->id])->assertOk();

        $staff = $staff->fresh();
        $this->assertTrue($staff->hasRole($this->managerRole));
        $this->assertFalse($staff->hasRole($this->staffRole));
        $this->assertTrue($staff->checkPermissionTo('vendor-vehicles-list-create'));
    }

    public function test_roles_endpoint_lists_the_shops_roles_and_what_each_can_do(): void
    {
        $this->as($this->owner)->getJson('/api/vendor/staff/roles')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['vendor-vehicles-list-create'])
            ->assertJsonPath('data.0.name', 'Manager')
            ->assertJsonPath('data.1.name', 'Staff');
    }

    public function test_another_shops_role_cannot_be_given_to_staff(): void
    {
        $otherShop = RentalShop::factory()->create();
        $foreign = $this->shopRole($otherShop->id, 'Staff', ['vendor-dashboard-view']);

        $this->addStaff(['role_id' => $foreign->id])->assertUnprocessable()->assertJsonValidationErrors('role_id');
    }

    public function test_a_manager_cannot_manage_staff(): void
    {
        $this->addStaff(['role_id' => $this->managerRole->id])->assertCreated();
        $manager = User::where('email', 'kasun@example.com')->first();

        $this->as($manager)->postJson('/api/vendor/staff', [
            'name' => 'Other', 'email' => 'other@example.com', 'password' => 'secret123', 'role_id' => $this->staffRole->id,
        ])->assertForbidden();
    }

    public function test_removing_staff_revokes_their_access(): void
    {
        $this->addStaff()->assertCreated();
        $staff = User::where('email', 'kasun@example.com')->first();
        $staff->createToken('phone');

        $this->as($this->owner)->deleteJson("/api/vendor/staff/{$staff->id}")->assertOk();

        $staff->refresh();
        $this->assertNull($staff->shop_id);
        $this->assertFalse($staff->hasRole($this->staffRole));
        $this->assertSame(0, $staff->tokens()->count());
    }

    /** Staff-edit rights let a member manage colleagues, never promote themselves. */
    public function test_a_staff_member_with_staff_rights_cannot_change_their_own_role(): void
    {
        $hrRole = $this->shopRole($this->shop->id, 'HR', ['vendor-dashboard-view', 'vendor-staff-view', 'vendor-staff-edit']);

        $this->addStaff(['email' => 'hr@example.com', 'role_id' => $hrRole->id])->assertCreated();
        $this->addStaff(['email' => 'colleague@example.com', 'role_id' => $this->staffRole->id])->assertCreated();
        $hr = User::where('email', 'hr@example.com')->firstOrFail();
        $colleague = User::where('email', 'colleague@example.com')->firstOrFail();

        // Promoting themselves to Manager is refused and changes nothing.
        $this->as($hr)->putJson("/api/vendor/staff/{$hr->id}", ['name' => 'HR Person', 'role_id' => $this->managerRole->id])
            ->assertStatus(422);
        $this->assertTrue($hr->fresh()->hasRole($hrRole));
        $this->assertFalse($hr->fresh()->checkPermissionTo('vendor-vehicles-list-create'));

        // Editing their own details while keeping their role is fine.
        $this->as($hr)->putJson("/api/vendor/staff/{$hr->id}", ['name' => 'HR Person', 'role_id' => $hrRole->id])
            ->assertOk()->assertJsonPath('data.user.name', 'HR Person');

        // And they can still change a colleague's role.
        $this->as($hr)->putJson("/api/vendor/staff/{$colleague->id}", ['role_id' => $this->managerRole->id])
            ->assertOk()->assertJsonPath('data.role_label', 'Manager');
    }
}
