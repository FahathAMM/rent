<?php

namespace Tests\Feature;

use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_can_login_with_valid_credentials(): void
    {
        SystemAdmin::factory()->create(['email' => 'owner@platform.test', 'password' => 'password']);

        $response = $this->postJson('/api/platform/login', [
            'email' => 'owner@platform.test',
            'password' => 'password',
        ]);

        $response->assertOk()->assertJsonStructure(['message', 'data' => ['admin', 'token']]);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        SystemAdmin::factory()->create(['email' => 'owner@platform.test', 'password' => 'password']);

        $this->postJson('/api/platform/login', [
            'email' => 'owner@platform.test',
            'password' => 'wrong',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_inactive_platform_admin_cannot_login(): void
    {
        SystemAdmin::factory()->inactive()->create(['email' => 'inactive@platform.test', 'password' => 'password']);

        $this->postJson('/api/platform/login', [
            'email' => 'inactive@platform.test',
            'password' => 'password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_authenticated_platform_admin_can_get_own_profile(): void
    {
        $admin = SystemAdmin::factory()->create();

        $this->actingAs($admin, 'platform')->getJson('/api/platform/me')
            ->assertOk()
            ->assertJsonPath('data.email', $admin->email);
    }

    public function test_unauthenticated_request_to_platform_me_returns_401(): void
    {
        $this->getJson('/api/platform/me')->assertUnauthorized();
    }

    public function test_platform_admin_can_logout(): void
    {
        $admin = SystemAdmin::factory()->create();

        $this->actingAs($admin, 'platform')->postJson('/api/platform/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully');
    }
}
