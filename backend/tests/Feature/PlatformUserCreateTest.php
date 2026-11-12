<?php

namespace Tests\Feature;

use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** The /platform/users page: creating platform admin accounts. Only the Platform Owner may create. */
class PlatformUserCreateTest extends TestCase
{
    use RefreshDatabase;

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name'       => 'New Admin',
            'email'      => 'new.admin@example.com',
            'password'   => 'secret-pass-123',
            'admin_role' => SystemAdmin::ROLE_ADMIN,
        ], $overrides);
    }

    public function test_owner_can_create_a_platform_admin(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->as($owner)->postJson('/api/platform/users', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.email', 'new.admin@example.com')
            ->assertJsonPath('data.admin_role', 'admin')
            ->assertJsonMissingPath('data.password');

        $admin = SystemAdmin::where('email', 'new.admin@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('secret-pass-123', $admin->password), 'password must be stored hashed');
        $this->assertDatabaseHas('audit_logs', ['form' => 'SystemAdmin', 'action' => 'create', 'record_id' => $admin->id]);
    }

    public function test_new_admin_can_log_in(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $this->as($owner)->postJson('/api/platform/users', $this->payload())->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => ''])
            ->postJson('/api/platform/login', ['email' => 'new.admin@example.com', 'password' => 'secret-pass-123'])
            ->assertOk();
    }

    public function test_every_role_can_be_created(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        foreach (['platform_owner', 'admin', 'finance', 'moderator', 'support'] as $role) {
            $this->as($owner)->postJson('/api/platform/users', $this->payload(['email' => "$role@example.com", 'admin_role' => $role]))
                ->assertCreated()
                ->assertJsonPath('data.admin_role', $role);
        }
    }

    public function test_non_owner_admins_cannot_create(): void
    {
        foreach (['admin', 'finance', 'moderator', 'support'] as $role) {
            $actor = SystemAdmin::factory()->create(['admin_role' => $role]);

            $this->as($actor)->postJson('/api/platform/users', $this->payload(['email' => "by-$role@example.com"]))
                ->assertForbidden();
        }

        $this->assertDatabaseMissing('system_admins', ['email' => 'by-admin@example.com']);
    }

    public function test_guests_cannot_create(): void
    {
        $this->postJson('/api/platform/users', $this->payload())->assertUnauthorized();
    }

    public function test_validation_rules(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        SystemAdmin::factory()->create(['email' => 'taken@example.com']);

        $this->as($owner)->postJson('/api/platform/users', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password', 'admin_role']);

        $this->as($owner)->postJson('/api/platform/users', $this->payload(['email' => 'taken@example.com']))
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);

        $this->as($owner)->postJson('/api/platform/users', $this->payload(['password' => 'short']))
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);

        $this->as($owner)->postJson('/api/platform/users', $this->payload(['admin_role' => 'superuser']))
            ->assertUnprocessable()->assertJsonValidationErrors(['admin_role']);
    }

    /** Exactly what the /platform/users "New Platform Admin" form posts. */
    public function test_payload_sent_by_the_frontend_create_form(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->as($owner)->postJson('/api/platform/users', [
            'name'       => 'Form Admin',
            'email'      => 'form.admin@example.com',
            'password'   => 'secret-pass-123',
            'admin_role' => 'admin',
        ])->assertCreated()->assertJsonPath('data.is_active', true);
    }

    /** Exactly what the "Edit Platform Admin" form puts: role + status change, blank password kept out. */
    public function test_payload_sent_by_the_frontend_edit_form(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $admin = SystemAdmin::factory()->create(['password' => 'original-pass-1']);

        $this->as($owner)->putJson("/api/platform/users/{$admin->id}", [
            'name'       => $admin->name,
            'email'      => $admin->email,
            'admin_role' => 'finance',
            'is_active'  => false,
        ])->assertOk()
            ->assertJsonPath('data.admin_role', 'finance')
            ->assertJsonPath('data.is_active', false);

        $this->assertTrue(Hash::check('original-pass-1', $admin->fresh()->password), 'password must be unchanged');
    }
}
