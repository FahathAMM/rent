<?php

namespace Tests\Feature;

use App\Models\Company;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);
    }

    /**
     * No Subscription/Plan/CompanySetting row gets created by registration
     * any more (those belonged to the CRM/Invoicing/Accounting modules'
     * onboarding flow) — a self-registered company just lands in `initiate`,
     * locked out of everything but the account-pending endpoints
     * (EnsureCompanyActivated) until a Platform Admin activates it.
     */
    public function test_registration_creates_company_and_owner(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'company_name'          => 'Acme Trading LLC',
            'name'                  => 'Jane Owner',
            'email'                 => 'jane@acme.test',
            'phone'                 => '+971500000000',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['message', 'data' => ['user', 'token']])
            ->assertJsonPath('data.user.email', 'jane@acme.test')
            ->assertJsonPath('data.user.roles.0', 'owner');

        $company = Company::where('name', 'Acme Trading LLC')->firstOrFail();
        $this->assertEquals('initiate', $company->status);

        $this->assertDatabaseHas('users', [
            'email'      => 'jane@acme.test',
            'company_id' => $company->id,
        ]);
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        $this->postJson('/api/auth/register', [
            'company_name'          => 'First Co',
            'name'                  => 'First Owner',
            'email'                 => 'dup@acme.test',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/auth/register', [
            'company_name'          => 'Second Co',
            'name'                  => 'Second Owner',
            'email'                 => 'dup@acme.test',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_registration_rejects_password_mismatch(): void
    {
        $this->postJson('/api/auth/register', [
            'company_name'          => 'Acme Trading LLC',
            'name'                  => 'Jane Owner',
            'email'                 => 'jane2@acme.test',
            'password'              => 'password123',
            'password_confirmation' => 'not-matching',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_registered_owner_can_log_in_with_the_returned_token(): void
    {
        $this->postJson('/api/auth/register', [
            'company_name'          => 'Acme Trading LLC',
            'name'                  => 'Jane Owner',
            'email'                 => 'jane3@acme.test',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $login = $this->postJson('/api/auth/login', [
            'email'    => 'jane3@acme.test',
            'password' => 'password123',
        ])->assertOk();

        $token = $login->json('data.token');

        // The freshly-registered company is still `initiate` (awaiting
        // Platform Admin activation), so only the account-pending endpoints
        // are reachable — see EnsureCompanyActivated. /api/auth/me is one.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'jane3@acme.test');
    }
}
