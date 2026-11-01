<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Until a shop is verified its owner only has onboarding — the whole vendor workspace is closed (EnsureShopVerified). */
class UnverifiedShopAccessTest extends TestCase
{
    use RefreshDatabase;

    private const VENDOR_ENDPOINTS = [
        '/api/dashboard', '/api/vehicles', '/api/locations', '/api/vendor/shop-profile',
        '/api/vendor/bookings', '/api/vendor/earnings', '/api/vendor/bank-details',
        '/api/vendor/staff', '/api/vendor/roles', '/api/expenses', '/api/audit-logs',
    ];

    private function registerShop(): array
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

        return [$user->fresh(), $token];
    }

    private function fetch(string $token, string $url)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', "Bearer {$token}")->getJson($url);
    }

    public function test_unverified_owner_cannot_reach_any_vendor_endpoint(): void
    {
        [, $token] = $this->registerShop();

        foreach (self::VENDOR_ENDPOINTS as $url) {
            $this->fetch($token, $url)->assertForbidden();
        }
    }

    public function test_unverified_owner_still_has_onboarding(): void
    {
        [, $token] = $this->registerShop();

        $this->fetch($token, '/api/onboarding/shops')->assertOk()->assertJsonCount(1, 'data');
        $this->fetch($token, '/api/auth/me')->assertOk()->assertJsonPath('data.shop.is_verified', false);
    }

    public function test_unverified_owner_gets_no_vendor_menu(): void
    {
        [, $token] = $this->registerShop();

        $this->fetch($token, '/api/menus/navigation?audience=vendor')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_verification_opens_the_workspace(): void
    {
        [$user, $token] = $this->registerShop();
        $user->shop->update(['verification_status' => RentalShop::VERIFICATION_VERIFIED]);
        // What ShopOnboardingService::verify() also does — without a plan, Free locks staff (/api/vendor/staff).
        app(\App\Services\SubscriptionService::class)->startTrial($user->shop->fresh());

        foreach (['/api/dashboard', '/api/vehicles', '/api/vendor/staff', '/api/vendor/shop-profile'] as $url) {
            $this->fetch($token, $url)->assertOk();
        }
        $this->fetch($token, '/api/auth/me')->assertJsonPath('data.shop.is_verified', true);
        $this->assertNotEmpty($this->fetch($token, '/api/menus/navigation?audience=vendor')->json('data'));
    }
}
