<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Role;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A newly registered shop starts with default policies and its own shop-owner role, held by whoever registered it. */
class ShopOnboardingDefaultsTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_shop_gets_default_policies(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken)
            ->postJson('/api/onboarding/shops', [
                'name' => 'Galle Rides', 'email' => 'hello@gallerides.lk', 'phone' => '0771234567', 'whatsapp' => '0771234567',
                'address_line_1' => '12 Lighthouse Street', 'city' => 'Galle', 'district' => 'Galle',
            ])
            ->assertSuccessful();

        $shop = RentalShop::where('owner_user_id', $user->id)->firstOrFail();
        $this->assertEquals(RentalShop::DEFAULT_POLICIES, $shop->policies);
    }

    public function test_registering_a_shop_makes_the_user_its_owner(): void
    {
        $this->seed(MenuSeeder::class);
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/onboarding/shops', [
                'name' => 'Galle Rides', 'email' => 'hello@gallerides.lk', 'phone' => '0771234567', 'whatsapp' => '0771234567',
                'address_line_1' => '12 Lighthouse Street', 'city' => 'Galle', 'district' => 'Galle',
            ])
            ->assertSuccessful();

        $user->refresh();
        $shop = RentalShop::where('owner_user_id', $user->id)->firstOrFail();
        $this->assertSame($shop->id, (int) $user->shop_id);
        $this->assertTrue($user->hasRole('shop-owner'), 'the owner gets shop-owner on registration, before verification');
        $this->assertSame(RentalShop::VERIFICATION_UNVERIFIED, $shop->verification_status);

        // /auth/me reports the owner role (the workspace itself stays closed until verified — UnverifiedShopAccessTest).
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.shop.role', 'owner')
            ->assertJsonFragment(['shop-owner']);
    }

    public function test_new_shop_gets_only_its_own_shop_owner_role(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken)
            ->postJson('/api/onboarding/shops', [
                'name' => 'Galle Rides', 'email' => 'hello@gallerides.lk', 'phone' => '0771234567', 'whatsapp' => '0771234567',
                'address_line_1' => '12 Lighthouse Street', 'city' => 'Galle', 'district' => 'Galle',
            ])
            ->assertSuccessful();

        $shop = RentalShop::where('owner_user_id', $user->id)->firstOrFail();
        $roles = Role::ofShop($shop->id)->get();

        $this->assertSame([Role::SHOP_OWNER], $roles->pluck('name')->all());
        $this->assertTrue($user->fresh()->hasRole($roles->first()));
    }

    public function test_contact_and_location_are_required(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken)
            ->postJson('/api/onboarding/shops', ['name' => 'Galle Rides'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'phone', 'whatsapp', 'address_line_1', 'district', 'city']);

        $this->assertNull($user->fresh()->shop_id);
    }
}
