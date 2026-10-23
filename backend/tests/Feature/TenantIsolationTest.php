<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Company;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected Company $companyA;
    protected Company $companyB;
    protected User $ownerA;
    protected User $ownerB;
    protected User $staffB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MenuSeeder::class);

        // All fixture creation happens with no authenticated user, so the
        // BelongsToCompany creating hook leaves the explicit company_id alone.
        $this->companyA = Company::factory()->create(['name' => 'Company A']);
        $this->companyB = Company::factory()->create(['name' => 'Company B']);

        $this->ownerA = User::factory()->forCompany($this->companyA)->role('owner')->create(['email' => 'ownerA@test.com']);
        $this->ownerB = User::factory()->forCompany($this->companyB)->role('owner')->create(['email' => 'ownerB@test.com']);
        $this->staffB = User::factory()->forCompany($this->companyB)->role('staff')->create(['email' => 'staffB@test.com']);
    }

    public function test_company_a_user_list_never_includes_company_b_users(): void
    {
        $response = $this->actingAs($this->ownerA, 'sanctum')->getJson('/api/users')->assertOk();

        $emails = collect($response->json('record.data'))->pluck('email')->all();

        $this->assertContains('ownerA@test.com', $emails);
        $this->assertNotContains('ownerB@test.com', $emails);
        $this->assertNotContains('staffB@test.com', $emails);
    }

    public function test_company_a_cannot_view_company_b_user_by_manipulating_id(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->getJson("/api/users/{$this->staffB->id}")
            ->assertNotFound();
    }

    public function test_company_a_cannot_update_company_b_user_by_manipulating_id(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->putJson("/api/users/{$this->staffB->id}", ['name' => 'Hacked Name'])
            ->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $this->staffB->id, 'name' => $this->staffB->name]);
    }

    public function test_company_a_cannot_delete_company_b_user_by_manipulating_id(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->deleteJson("/api/users/{$this->staffB->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $this->staffB->id, 'deleted_at' => null]);
    }

    public function test_creating_a_user_always_stamps_the_actors_own_company_regardless_of_input(): void
    {
        $response = $this->actingAs($this->ownerA, 'sanctum')
            ->postJson('/api/users', [
                'name'       => 'Sneaky New User',
                'email'      => 'sneaky@test.com',
                'password'   => 'password123',
                // attempting to plant this user in Company B by forging the id
                'company_id' => $this->companyB->id,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('users', [
            'email'      => 'sneaky@test.com',
            'company_id' => $this->companyA->id,
        ]);
    }

    public function test_super_admin_sees_users_from_every_company(): void
    {
        $superAdmin = User::factory()->role('super-admin')->create();

        $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/users')->assertOk();

        $emails = collect($response->json('record.data'))->pluck('email')->all();

        $this->assertContains('ownerA@test.com', $emails);
        $this->assertContains('ownerB@test.com', $emails);
    }

    public function test_non_super_admin_cannot_grant_super_admin_role(): void
    {
        $this->actingAs($this->ownerA, 'sanctum')
            ->postJson('/api/users', [
                'name'     => 'Escalation Attempt',
                'email'    => 'escalate@test.com',
                'password' => 'password123',
                'roles'    => ['super-admin'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('roles');
    }
}
