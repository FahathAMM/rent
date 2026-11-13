<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Customers and vendors must agree to the terms and privacy policy to sign up, and we record when.
 * Customers can also register with a mobile number instead of an email, verified by an SMS OTP (text.lk).
 */
class RegistrationConsentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Never reach the real text.lk from tests (whatever .env says), and keep
        // fake test SMS out of the real storage/logs/sms/ log.
        config(['services.textlk.enabled' => false]);
        Http::preventStrayRequests();
        config(['logging.channels.sms' => ['driver' => 'monolog', 'handler' => \Monolog\Handler\NullHandler::class]]);
    }

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

    private const PHONE_FORM = [
        'name' => 'Kamal Silva',
        'phone' => '077 123 4567',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'terms_accepted' => true,
    ];

    public function test_send_otp_texts_a_code_through_textlk(): void
    {
        config(['services.textlk.enabled' => true, 'services.textlk.api_key' => 'key', 'services.textlk.sender_id' => 'Enscone']);
        Http::fake(['app.text.lk/*' => Http::response(['status' => 'success'])]);

        $this->postJson('/api/customer/send-otp', ['phone' => '0771234567'])->assertOk();

        $code = Cache::get('customer-otp:94771234567')['code'];
        Http::assertSent(fn ($r) => $r->url() === 'https://app.text.lk/api/v3/sms/send'
            && $r->hasHeader('Authorization', 'Bearer key')
            && $r['recipient'] === '94771234567'
            && $r['sender_id'] === 'Enscone'
            && str_contains($r['message'], $code));
    }

    public function test_send_otp_reports_a_textlk_failure(): void
    {
        config(['services.textlk.enabled' => true, 'services.textlk.api_key' => 'key']);
        Http::fake(['app.text.lk/*' => Http::response(['status' => 'error', 'message' => 'Insufficient balance'])]);

        $this->postJson('/api/customer/send-otp', ['phone' => '0771234567'])
            ->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    public function test_send_otp_rejects_bad_or_taken_numbers(): void
    {
        $this->postJson('/api/customer/send-otp', ['phone' => '12345'])->assertJsonValidationErrors('phone');

        Customer::factory()->create(['phone' => '94771234567']);
        $this->postJson('/api/customer/send-otp', ['phone' => '0771234567'])->assertJsonValidationErrors('phone');
    }

    public function test_customer_registers_with_mobile_and_otp_then_logs_in_with_it(): void
    {
        $this->postJson('/api/customer/send-otp', ['phone' => '0771234567'])->assertOk();
        $code = Cache::get('customer-otp:94771234567')['code'];

        $this->postJson('/api/customer/register', self::PHONE_FORM + ['otp' => $code])->assertCreated();

        $customer = Customer::where('phone', '94771234567')->first();
        $this->assertNull($customer->email);
        $this->assertNotNull($customer->phone_verified_at);

        // Login field "email" also accepts the mobile number.
        $this->postJson('/api/customer/login', ['email' => '0771234567', 'password' => 'password123'])->assertOk();
    }

    public function test_register_with_mobile_needs_the_right_otp(): void
    {
        $this->postJson('/api/customer/register', self::PHONE_FORM)->assertJsonValidationErrors('otp');

        $this->postJson('/api/customer/send-otp', ['phone' => '0771234567'])->assertOk();
        $this->postJson('/api/customer/register', self::PHONE_FORM + ['otp' => '000000'])->assertJsonValidationErrors('otp');

        $this->assertDatabaseMissing('customers', ['phone' => '94771234567']);
    }

    public function test_register_needs_email_or_mobile(): void
    {
        $form = self::FORM + ['terms_accepted' => true];
        unset($form['email']);

        $this->postJson('/api/customer/register', $form)->assertJsonValidationErrors(['email', 'phone']);
    }
}
