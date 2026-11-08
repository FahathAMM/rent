<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Customers and vendors must agree to the terms and privacy policy to sign up, and we record when. */
class RegistrationConsentTest extends TestCase
{
    use RefreshDatabase;

    private const FORM = [
        'name' => 'Nimal Perera',
        'email' => 'nimal@example.test',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ];

    public function test_customer_cannot_register_without_agreeing(): void
    {
        $this->postJson('/api/customer/register', self::FORM)
            ->assertUnprocessable()->assertJsonValidationErrors('terms_accepted');
        $this->postJson('/api/customer/register', self::FORM + ['terms_accepted' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('terms_accepted');

        $this->assertDatabaseMissing('customers', ['email' => self::FORM['email']]);
    }

    public function test_customer_agreement_is_recorded(): void
    {
        $this->postJson('/api/customer/register', self::FORM + ['terms_accepted' => true])->assertCreated();

        $this->assertNotNull(Customer::where('email', self::FORM['email'])->first()->terms_accepted_at);
    }

    public function test_vendor_cannot_register_without_agreeing(): void
    {
        $this->postJson('/api/auth/register', self::FORM)
            ->assertUnprocessable()->assertJsonValidationErrors('terms_accepted');

        $this->assertDatabaseMissing('users', ['email' => self::FORM['email']]);
    }

    public function test_vendor_agreement_is_recorded(): void
    {
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);

        $this->postJson('/api/auth/register', self::FORM + ['terms_accepted' => true])->assertCreated();

        $this->assertNotNull(User::where('email', self::FORM['email'])->first()->terms_accepted_at);
    }
}
