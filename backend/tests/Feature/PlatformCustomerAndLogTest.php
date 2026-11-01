<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/** Platform admin's customer management works on the `customers` table, and the log viewer can download. */
class PlatformCustomerAndLogTest extends TestCase
{
    use RefreshDatabase;

    private function admin()
    {
        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}")->withHeader('Accept', 'application/json');
    }

    public function test_customer_list_shows_customers_not_vendor_users(): void
    {
        $customer = Customer::factory()->create(['name' => 'Nimal Customer']);
        User::factory()->create(['name' => 'Vendor Person']);

        $this->admin()->getJson('/api/platform/customers')
            ->assertOk()
            ->assertJsonPath('record.total', 1)
            ->assertJsonPath('record.data.0.id', $customer->id)
            ->assertJsonPath('record.data.0.bookings_count', 0);
    }

    public function test_customer_list_filters_by_search_and_status(): void
    {
        Customer::factory()->create(['name' => 'Kasun Perera']);
        Customer::factory()->create(['name' => 'Other Person', 'status' => Customer::STATUS_BANNED]);

        $this->admin()->getJson('/api/platform/customers?search=kasun')->assertJsonPath('record.total', 1);
        $this->admin()->getJson('/api/platform/customers?status=banned')->assertJsonPath('record.data.0.name', 'Other Person');
    }

    public function test_customer_detail_loads(): void
    {
        $customer = Customer::factory()->create();

        $this->admin()->getJson("/api/platform/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id)
            ->assertJsonPath('data.bookings_count', 0);
    }

    public function test_suspending_a_customer_revokes_their_tokens_and_activate_restores(): void
    {
        $customer = Customer::factory()->create();
        $customer->createToken('session');

        $this->admin()->postJson("/api/platform/customers/{$customer->id}/suspend", ['reason' => 'Fraud check'])
            ->assertOk()
            ->assertJsonPath('data.status', Customer::STATUS_SUSPENDED);
        $this->assertSame(0, $customer->tokens()->count());

        $this->admin()->postJson("/api/platform/customers/{$customer->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', Customer::STATUS_ACTIVE);
    }

    public function test_log_file_downloads(): void
    {
        $name = 'test-download-' . uniqid() . '.log';
        File::put(storage_path("logs/{$name}"), "[2026-10-30 10:00:00] testing.INFO: hello\n");

        try {
            $this->admin()->get("/api/platform/logs/download?file={$name}")
                ->assertOk()
                ->assertDownload($name);
        } finally {
            File::delete(storage_path("logs/{$name}"));
        }
    }

    public function test_missing_log_file_is_a_404(): void
    {
        $this->admin()->getJson('/api/platform/logs/download?file=does-not-exist.log')->assertNotFound();
    }
}
