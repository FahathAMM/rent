<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A newly registered shop starts with RentalShop::DEFAULT_POLICIES, which the owner can then edit. */
class ShopOnboardingDefaultsTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_shop_gets_default_policies(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test')->plainTextToken)
            ->postJson('/api/onboarding/shops', ['name' => 'Galle Rides'])
            ->assertSuccessful();

        $shop = RentalShop::where('owner_user_id', $user->id)->firstOrFail();
        $this->assertEquals(RentalShop::DEFAULT_POLICIES, $shop->policies);
    }
}
