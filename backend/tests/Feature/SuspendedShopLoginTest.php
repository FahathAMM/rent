<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A suspended shop's owner and staff can't log in, and a session they already had gets no vendor menu. */
class SuspendedShopLoginTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->owner = User::factory()->create(['password' => bcrypt('secret-pass')]);
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['shop_id' => $this->shop->id]);
    }

    private function login()
    {
        return $this->postJson('/api/auth/login', ['email' => $this->owner->email, 'password' => 'secret-pass']);
    }

    public function test_an_active_shop_owner_can_log_in(): void
    {
        $this->login()->assertOk()->assertJsonPath('data.user.shop.is_suspended', false);
    }

    public function test_a_suspended_shop_owner_cannot_log_in_and_is_sent_to_the_admin(): void
    {
        $this->shop->update(['status' => RentalShop::STATUS_SUSPENDED, 'suspended_reason' => 'Unpaid fees']);

        $response = $this->login()->assertUnprocessable()->assertJsonValidationErrors('email');

        $message = $response->json('errors.email.0');
        $this->assertStringStartsWith('Your rental shop has been suspended. Please contact the ', $message);
        $this->assertStringNotContainsString('Unpaid fees', $message, 'the internal reason is not shown');
    }

    public function test_an_existing_session_gets_no_vendor_menu_once_suspended(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;
        $this->shop->update(['status' => RentalShop::STATUS_SUSPENDED]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/menus/navigation?audience=vendor')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertJsonPath('data.shop.is_suspended', true);
    }
}
