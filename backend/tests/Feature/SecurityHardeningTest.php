<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Attachment;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Location;
use App\Models\RentalShop;
use App\Models\Role;
use App\Models\ShopSettings;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePricing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Locks in the fixes from the 2026-11-10 security audit: the Log Viewer
 * API, cross-shop attachments, login rate limits, sign-out on password
 * change, booking locations and the dashboard's money figures.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function bearer(User|Customer|SystemAdmin $who)
    {
        // The resolved user is cached across requests within one test — clear it so each call is really $who.
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $who->createToken('t')->plainTextToken)
            ->withHeader('Accept', 'application/json');
    }

    /** @return array{0: User, 1: RentalShop} */
    private function shopWithOwner(): array
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole(User::SHOP_ROLE_OWNER);

        return [$owner->fresh(), $shop];
    }

    // ── Log Viewer ───────────────────────────────────────────────────────

    public function test_the_log_viewer_api_is_closed_without_the_owner(): void
    {
        config(['log-viewer.owner_email' => 'owner@example.com']);

        $this->getJson('/log-viewer/api/files')->assertForbidden();
        $this->getJson('/log-viewer/api/folders')->assertForbidden();

        // Another platform admin's token is refused too.
        $admin = SystemAdmin::factory()->create(['email' => 'someone-else@example.com']);
        $this->getJson('/log-viewer/api/files?token=' . $admin->createToken('t')->plainTextToken)->assertForbidden();
    }

    public function test_the_log_viewer_api_opens_for_the_owner_but_not_with_an_expired_token(): void
    {
        config(['log-viewer.owner_email' => 'owner@example.com']);
        $owner = SystemAdmin::factory()->create(['email' => 'owner@example.com']);

        $this->getJson('/log-viewer/api/files?token=' . $owner->createToken('t')->plainTextToken)->assertOk();

        $expired = $owner->createToken('old', ['*'], now()->subMinute())->plainTextToken;
        $this->getJson('/log-viewer/api/files?token=' . $expired)->assertForbidden();
    }

    public function test_nobody_gets_in_when_no_owner_email_is_set(): void
    {
        config(['log-viewer.owner_email' => null]);
        $admin = SystemAdmin::factory()->create();

        $this->getJson('/log-viewer/api/files?token=' . $admin->createToken('t')->plainTextToken)->assertForbidden();
    }

    // ── Attachments ──────────────────────────────────────────────────────

    public function test_another_shops_attachment_cannot_be_downloaded_or_deleted(): void
    {
        $this->seed(\Database\Seeders\MenuSeeder::class);
        Storage::fake('local');

        [$ownerA] = $this->shopWithOwner();
        [$ownerB, $shopB] = $this->shopWithOwner();

        $expenseB = Expense::factory()->create([
            'shop_id' => $shopB->id,
            'expense_category_id' => \App\Models\ExpenseCategory::factory()->create(['shop_id' => $shopB->id])->id,
        ]);
        Storage::disk('local')->put('attachments/expense/b.pdf', 'SHOP-B-RECEIPT');
        $file = Attachment::create([
            'shop_id' => $shopB->id, 'uploaded_by' => $ownerB->id, 'file_name' => 'b.pdf',
            'file_path' => 'attachments/expense/b.pdf', 'disk' => 'local', 'mime_type' => 'application/pdf',
            'file_size' => 14, 'attachable_type' => 'expense', 'attachable_id' => $expenseB->id,
        ]);

        $this->bearer($ownerA)->get("/api/attachments/{$file->id}/download")->assertNotFound();
        $this->bearer($ownerA)->deleteJson("/api/attachments/{$file->id}")->assertNotFound();
        $this->assertNotNull(Attachment::find($file->id));
        Storage::disk('local')->assertExists('attachments/expense/b.pdf');

        // Its own shop still can.
        $this->bearer($ownerB)->get("/api/attachments/{$file->id}/download")->assertOk();
    }

    // ── Login rate limits ────────────────────────────────────────────────

    public function test_logins_are_rate_limited(): void
    {
        foreach ([
            '/api/auth/login',
            '/api/customer/login',
            '/api/platform/login',
        ] as $url) {
            for ($i = 0; $i < 5; $i++) {
                $this->postJson($url, ['email' => 'guess@example.com', 'password' => 'wrong-' . $i])->assertStatus(422);
            }
            $this->postJson($url, ['email' => 'guess@example.com', 'password' => 'wrong-again'])->assertStatus(429);
        }
    }

    // ── Password change ──────────────────────────────────────────────────

    public function test_changing_a_password_signs_out_the_other_sessions(): void
    {
        $user = User::factory()->create(['password' => 'old-password-1']);
        $user->createToken('other-device');
        $current = $user->createToken('this-device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$current}")
            ->putJson('/api/auth/change-password', [
                'current_password' => 'old-password-1',
                'new_password' => 'new-password-1',
                'new_password_confirmation' => 'new-password-1',
            ])->assertOk();

        $this->assertSame(['this-device'], $user->tokens()->pluck('name')->all());

        $customer = Customer::factory()->create(['password' => 'old-password-1']);
        $customer->createToken('other-device');
        $current = $customer->createToken('this-device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$current}")
            ->putJson('/api/customer/change-password', [
                'current_password' => 'old-password-1',
                'new_password' => 'new-password-1',
                'new_password_confirmation' => 'new-password-1',
            ])->assertOk();

        $this->assertSame(['this-device'], $customer->tokens()->pluck('name')->all());
    }

    // ── Booking locations ────────────────────────────────────────────────

    public function test_a_booking_cannot_use_another_shops_location(): void
    {
        $shop = RentalShop::factory()->create(['status' => 'active', 'is_published' => true]);
        $otherShop = RentalShop::factory()->create();
        ShopSettings::createFor($shop->id);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Toyota Aqua 2020',
            'slug' => 'aqua-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'CAA-' . Str::random(4), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
        VehiclePricing::create(['vehicle_id' => $vehicle->id, 'daily_rate' => 7000, 'advance_notice_hours' => 0, 'min_rental_days' => 1]);

        $own = Location::create(['shop_id' => $shop->id, 'name' => 'Main branch']);
        $foreign = Location::create(['shop_id' => $otherShop->id, 'name' => 'Other shop branch']);

        $book = fn (int $locationId) => $this->bearer(Customer::factory()->create())->postJson('/api/bookings', [
            'vehicle_id' => $vehicle->id,
            'pickup_at' => now()->addDays(3)->setTime(10, 0)->toDateTimeString(),
            'return_at' => now()->addDays(5)->setTime(10, 0)->toDateTimeString(),
            'pickup_location_id' => $locationId,
            'payment_method' => 'cash',
        ]);

        $book($foreign->id)->assertUnprocessable()->assertJsonValidationErrors('pickup_location_id');
        $book($own->id)->assertCreated();
    }

    // ── Links people click ───────────────────────────────────────────────

    public function test_a_shop_website_must_be_a_plain_web_address(): void
    {
        $this->seed(\Database\Seeders\MenuSeeder::class);
        [$owner, $shop] = $this->shopWithOwner();

        foreach (['javascript:alert(document.cookie)', 'data:text/html,<script>alert(1)</script>'] as $bad) {
            $this->bearer($owner)->putJson('/api/vendor/shop-profile', ['name' => 'Shop', 'website' => $bad])
                ->assertUnprocessable()->assertJsonValidationErrors('website');
        }

        $this->bearer($owner)->putJson('/api/vendor/shop-profile', ['name' => 'Shop', 'website' => 'www.example.lk'])->assertOk();
        $this->assertSame('https://www.example.lk', $shop->fresh()->website);
    }

    public function test_a_menu_link_must_be_an_in_app_path(): void
    {
        $admin = SystemAdmin::factory()->create();

        foreach (['javascript:alert(1)', '//evil.example', 'https://evil.example'] as $bad) {
            $this->bearer($admin)->postJson('/api/platform/menus', [
                'audience' => 'vendor', 'name' => 'Bad', 'slug' => 'bad_' . Str::random(4), 'route_name' => $bad,
            ])->assertUnprocessable()->assertJsonValidationErrors('route_name');
        }
    }

    // ── Seeded accounts ──────────────────────────────────────────────────

    public function test_production_seeding_never_uses_a_known_password(): void
    {
        $this->app['env'] = 'production';

        // As on a server with no PLATFORM_ADMIN_* set (this machine's .env may set them).
        $keys = ['PLATFORM_ADMIN_PASSWORD', 'PLATFORM_ADMIN_EMAIL'];
        $saved = [];
        foreach ($keys as $key) {
            $saved[$key] = [getenv($key), $_ENV[$key] ?? null, $_SERVER[$key] ?? null];
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        }

        try {
            // Called directly — `db:seed` in production stops to ask for confirmation.
            (new \Database\Seeders\PlatformSeeder())->run();
        } finally {
            foreach ($saved as $key => [$getenv, $env, $server]) {
                if ($getenv !== false) putenv("{$key}={$getenv}");
                if ($env !== null) $_ENV[$key] = $env;
                if ($server !== null) $_SERVER[$key] = $server;
            }
        }

        $admin = SystemAdmin::where('email', 'admin@example.com')->firstOrFail();
        foreach (['Fahath@321', 'change-me-dev-only', 'password'] as $known) {
            $this->assertFalse(\Illuminate\Support\Facades\Hash::check($known, $admin->password), "seeded with '{$known}'");
        }
    }

    // ── Dashboard ────────────────────────────────────────────────────────

    public function test_the_dashboard_needs_its_permission_and_hides_money_without_earnings_access(): void
    {
        $this->seed(\Database\Seeders\MenuSeeder::class);
        [, $shop] = $this->shopWithOwner();

        $staffWith = function (array $permissions) use ($shop) {
            $role = Role::create(['name' => 'Role ' . Str::random(5), 'guard_name' => 'web', 'shop_id' => $shop->id]);
            $role->syncPermissions($permissions);
            $staff = User::factory()->create(['shop_id' => $shop->id]);
            $staff->setShopRole($role);

            return $staff;
        };

        $this->bearer($staffWith(['vendor-vehicles-inquiries-view']))->getJson('/api/dashboard')->assertForbidden();

        $this->bearer($staffWith(['vendor-dashboard-view']))->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.can_view_money', false)
            ->assertJsonPath('data.revenue', null)
            ->assertJsonPath('data.income_trend', []);

        $this->bearer($staffWith(['vendor-dashboard-view', 'vendor-finance-earnings-view']))->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.can_view_money', true);
    }

    // ── Uploads (2026-11-11 review) ──────────────────────────────────────

    /**
     * /storage is proxied onto the app's own origin, where the SPA keeps its bearer tokens in
     * localStorage — so a scripted SVG served from there is a stored XSS. Every publicly served
     * image upload must refuse SVG (the `image` rule alone accepts it).
     */
    public function test_svg_is_refused_wherever_an_uploaded_image_is_served_publicly(): void
    {
        Storage::fake('public');
        $svg = fn () => UploadedFile::fake()->create('avatar.svg', 4, 'image/svg+xml');
        $png = fn () => UploadedFile::fake()->image('avatar.png', 64, 64);

        $user = User::factory()->create();
        $this->bearer($user)->post('/api/auth/profile', ['_method' => 'PUT', 'avatar' => $svg()])
            ->assertUnprocessable()->assertJsonValidationErrors(['avatar']);
        $this->bearer($user)->post('/api/auth/profile', ['_method' => 'PUT', 'avatar' => $png()])->assertOk();

        $customer = Customer::factory()->create();
        $this->bearer($customer)->post('/api/customer/profile', ['_method' => 'PUT', 'avatar' => $svg()])
            ->assertUnprocessable()->assertJsonValidationErrors(['avatar']);

        $admin = SystemAdmin::factory()->owner()->create();
        $this->bearer($admin)->post('/api/platform/details', ['name' => 'LankaLane', 'logo' => $svg()])
            ->assertUnprocessable()->assertJsonValidationErrors(['logo']);
        $this->bearer($admin)->post('/api/platform/details', ['name' => 'LankaLane', 'login_logo' => $svg()])
            ->assertUnprocessable()->assertJsonValidationErrors(['login_logo']);

        $this->assertSame([], array_filter(Storage::disk('public')->allFiles(), fn ($f) => str_ends_with($f, '.svg')));
    }

    public function test_expense_attachments_only_accept_documents_and_images(): void
    {
        $this->seed(\Database\Seeders\MenuSeeder::class);
        Storage::fake('local');

        [$owner, $shop] = $this->shopWithOwner();
        $expense = Expense::factory()->create([
            'shop_id' => $shop->id,
            'expense_category_id' => \App\Models\ExpenseCategory::factory()->create(['shop_id' => $shop->id])->id,
        ]);
        $payload = ['attachable_type' => 'expense', 'attachable_id' => $expense->id];

        $this->bearer($owner)->post('/api/attachments', $payload + ['file' => UploadedFile::fake()->create('receipt.html', 2, 'text/html')])
            ->assertUnprocessable()->assertJsonValidationErrors(['file']);
        $this->bearer($owner)->post('/api/attachments', $payload + ['file' => UploadedFile::fake()->create('receipt.php', 2, 'application/x-httpd-php')])
            ->assertUnprocessable()->assertJsonValidationErrors(['file']);
        $this->bearer($owner)->post('/api/attachments', $payload + ['file' => UploadedFile::fake()->create('receipt.pdf', 2, 'application/pdf')])
            ->assertCreated();
    }

    // ── Platform admin accounts ──────────────────────────────────────────

    public function test_resetting_an_admins_password_or_deactivating_them_revokes_their_tokens(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $admin = SystemAdmin::factory()->create(['password' => 'original-pass-1']);
        $admin->createToken('laptop');
        $admin->createToken('phone');

        $this->bearer($owner)->putJson("/api/platform/users/{$admin->id}", ['password' => 'brand-new-pass-1'])->assertOk();
        $this->assertSame(0, $admin->tokens()->count(), 'a password reset must sign the admin out everywhere');

        $admin->createToken('laptop');
        $this->bearer($owner)->putJson("/api/platform/users/{$admin->id}", ['is_active' => false])->assertOk();
        $this->assertSame(0, $admin->tokens()->count(), 'deactivation must sign the admin out everywhere');

        // A plain edit keeps their sessions.
        $admin->update(['is_active' => true]);
        $admin->createToken('laptop');
        $this->bearer($owner)->putJson("/api/platform/users/{$admin->id}", ['name' => 'Renamed'])->assertOk();
        $this->assertSame(1, $admin->tokens()->count());

        // The owner can't lock themselves out.
        $this->bearer($owner)->putJson("/api/platform/users/{$owner->id}", ['is_active' => false])->assertStatus(422);
        $this->assertTrue($owner->fresh()->is_active);
    }

    // ── Log Viewer page ──────────────────────────────────────────────────

    public function test_the_log_viewer_page_moves_the_token_out_of_the_url_once_the_session_is_set(): void
    {
        config(['log-viewer.owner_email' => 'owner@example.com']);
        $owner = SystemAdmin::factory()->create(['email' => 'owner@example.com']);

        $this->get('/log-viewer?token=' . $owner->createToken('t')->plainTextToken)
            ->assertRedirect('/log-viewer')
            ->assertSessionHas('log_viewer_owner_email', 'owner@example.com');

        // Somebody else's token never gets a session, let alone a redirect. (The test client keeps
        // the session between requests, so start this one clean like a fresh browser would.)
        $this->flushSession();
        $other = SystemAdmin::factory()->create(['email' => 'other@example.com']);
        $this->get('/log-viewer?token=' . $other->createToken('t')->plainTextToken)
            ->assertForbidden()
            ->assertSessionMissing('log_viewer_owner_email');
    }

    // ── Customer phone number (2026-11-12 review) ────────────────────────

    /**
     * A verified phone is a login identity. Changing it must take the OTP sent to the new number —
     * otherwise a customer could put anyone's number on their own account, still marked verified.
     */
    public function test_a_customer_cannot_change_their_phone_without_the_otp_sent_to_it(): void
    {
        $customer = Customer::factory()->create(['phone' => '94771111111', 'phone_verified_at' => now()]);

        $this->bearer($customer)->putJson('/api/customer/profile', ['phone' => '0772222222'])
            ->assertUnprocessable()->assertJsonValidationErrors(['otp']);
        $this->bearer($customer)->putJson('/api/customer/profile', ['phone' => 'not-a-number', 'otp' => '123456'])
            ->assertUnprocessable()->assertJsonValidationErrors(['phone']);

        $this->postJson('/api/customer/send-otp', ['phone' => '0772222222'])->assertOk();
        $this->bearer($customer)->putJson('/api/customer/profile', ['phone' => '0772222222', 'otp' => '000000'])
            ->assertUnprocessable()->assertJsonValidationErrors(['otp']);
        $this->assertSame('94771111111', $customer->fresh()->phone);

        $code = Cache::get('customer-otp:94772222222')['code'];
        $this->bearer($customer)->putJson('/api/customer/profile', ['phone' => '0772222222', 'otp' => $code])->assertOk();
        $this->assertSame('94772222222', $customer->fresh()->phone);
        $this->assertNotNull($customer->fresh()->phone_verified_at);
    }

    public function test_a_customer_cannot_take_a_number_that_is_already_registered(): void
    {
        Customer::factory()->create(['phone' => '94773333333', 'phone_verified_at' => now()]);
        $customer = Customer::factory()->create(['phone' => '94771111111', 'phone_verified_at' => now()]);

        $this->bearer($customer)->putJson('/api/customer/profile', ['phone' => '077 333 3333', 'otp' => '123456'])
            ->assertUnprocessable()->assertJsonValidationErrors(['phone']);
        $this->assertSame('94771111111', $customer->fresh()->phone);
    }

    public function test_saving_the_profile_with_the_same_phone_needs_no_otp(): void
    {
        $customer = Customer::factory()->create(['phone' => '94771111111', 'phone_verified_at' => now()]);

        // However it is typed, it is still their own number.
        $this->bearer($customer)->putJson('/api/customer/profile', ['name' => 'New Name', 'phone' => '0771111111'])->assertOk();

        $this->assertSame('New Name', $customer->fresh()->name);
        $this->assertSame('94771111111', $customer->fresh()->phone);
        $this->assertNotNull($customer->fresh()->phone_verified_at);
    }

    public function test_a_login_that_is_not_a_mobile_number_never_matches_an_account_without_a_phone(): void
    {
        // An account that dropped its phone still has phone_verified_at from before.
        Customer::factory()->create(['email' => 'a@example.com', 'phone' => null, 'phone_verified_at' => now(), 'password' => 'password123']);

        $this->postJson('/api/customer/login', ['email' => 'not-a-number', 'password' => 'password123'])
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }
}
