<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\ImpersonationSession;
use App\Models\SystemAdmin;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every request here authenticates via a real bearer token (never
 * actingAs()) so the full Sanctum provider-matching path is exercised end
 * to end — this is the mechanism that keeps a platform admin token and a
 * company user token from ever being interchangeable.
 */
class PlatformImpersonationTest extends TestCase
{
    use RefreshDatabase;

    protected SystemAdmin $admin;
    protected string $adminToken;
    protected Company $company;
    protected User $targetUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        $this->admin = SystemAdmin::factory()->create();
        $this->adminToken = $this->admin->createToken('t')->plainTextToken;
        $this->company = Company::factory()->create();
        $this->targetUser = User::factory()->forCompany($this->company)->role('staff')->create();
    }

    private function asAdmin()
    {
        return $this->withHeader('Authorization', "Bearer {$this->adminToken}");
    }

    public function test_platform_admin_can_start_impersonation_without_the_users_password(): void
    {
        $response = $this->asAdmin()
            ->postJson('/api/platform/impersonation/start', ['user_id' => $this->targetUser->id])
            ->assertOk();

        $response->assertJsonStructure(['message', 'data' => ['token', 'session_id', 'user', 'company']]);

        $this->assertDatabaseHas('impersonation_sessions', [
            'system_admin_id' => $this->admin->id,
            'company_id'      => $this->company->id,
            'user_id'         => $this->targetUser->id,
            'ended_at'        => null,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'impersonate_start',
            'system_admin_id' => $this->admin->id,
            'user_id' => $this->targetUser->id,
        ]);
    }

    public function test_impersonation_token_authenticates_as_the_target_company_user(): void
    {
        $start = $this->asAdmin()
            ->postJson('/api/platform/impersonation/start', ['user_id' => $this->targetUser->id])
            ->assertOk();

        $token = $start->json('data.token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $this->targetUser->id);
    }

    public function test_platform_admin_can_stop_impersonation_and_the_token_is_revoked(): void
    {
        $start = $this->asAdmin()
            ->postJson('/api/platform/impersonation/start', ['user_id' => $this->targetUser->id])
            ->assertOk();

        $token = $start->json('data.token');
        $sessionId = $start->json('data.session_id');

        $this->asAdmin()
            ->postJson('/api/platform/impersonation/stop', ['session_id' => $sessionId])
            ->assertOk();

        $session = ImpersonationSession::find($sessionId);
        $this->assertNotNull($session->ended_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'impersonate_stop',
            'system_admin_id' => $this->admin->id,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_cannot_impersonate_an_inactive_user(): void
    {
        $inactiveUser = User::factory()->forCompany($this->company)->inactive()->create();

        $this->asAdmin()
            ->postJson('/api/platform/impersonation/start', ['user_id' => $inactiveUser->id])
            ->assertUnprocessable();
    }
}
