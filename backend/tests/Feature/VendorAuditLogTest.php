<?php

namespace Tests\Feature;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * A shop's own audit trail (/api/audit-logs, the vendor "Audit Logs" page):
 * owner-only, confined to the shop, and fed by the vendor actions that
 * previously left no trace (login/logout, listing status changes, ...).
 */
class VendorAuditLogTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private RentalShop $shop;
    private User $otherOwner;
    private RentalShop $otherShop;

    protected function setUp(): void
    {
        parent::setUp();
        [$this->owner, $this->shop] = $this->makeShop();
        [$this->otherOwner, $this->otherShop] = $this->makeShop();
    }

    private function makeShop(): array
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $shop->id]);
        $owner->setShopRole('owner');

        return [$owner, $shop];
    }

    private function makeVehicle(RentalShop $shop, string $title): Vehicle
    {
        $category = VehicleCategory::firstOrCreate(['slug' => 'car'], ['name' => 'Car', 'sort_order' => 1, 'is_active' => true]);

        return Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::random(6), 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'AAA-' . Str::random(6), 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function row(string $form, string $action, ?array $extra = []): array
    {
        return array_merge([
            'user_id' => $this->owner->id, 'shop_id' => $this->shop->id, 'action' => $action, 'form' => $form,
        ], $extra);
    }

    public function test_the_owner_sees_only_their_own_shop_s_rows_and_never_views(): void
    {
        AuditLog::create($this->row('Vehicle', 'edit', ['record' => 'Own Aqua']));
        AuditLog::create($this->row('Vehicle', 'view', ['record' => 'Own Aqua (viewed)']));
        AuditLog::create(['user_id' => $this->otherOwner->id, 'shop_id' => $this->otherShop->id, 'action' => 'edit', 'form' => 'Vehicle', 'record' => 'Other Aqua']);
        AuditLog::create(['system_admin_id' => null, 'shop_id' => null, 'action' => 'edit', 'form' => 'VehicleBrand', 'record' => 'Platform only']);

        $rows = $this->as($this->owner)->getJson('/api/audit-logs')->assertOk()->json('record.data');

        $this->assertSame(['Own Aqua'], array_column($rows, 'record'));
    }

    public function test_the_log_can_be_filtered_by_date_range(): void
    {
        $at = ['Old' => '2026-01-05 10:00:00', 'In range' => '2026-02-10 10:00:00', 'Edge' => '2026-02-28 23:59:00', 'New' => '2026-03-01 00:00:00'];
        foreach ($at as $record => $createdAt) {
            // created_at is not fillable, so stamp it after the insert.
            AuditLog::create($this->row('Vehicle', 'edit', ['record' => $record]))->forceFill(['created_at' => $createdAt])->saveQuietly();
        }

        $rows = $this->as($this->owner)->getJson('/api/audit-logs?date_from=2026-02-01&date_to=2026-02-28&sort_field=created_at&sort_direction=asc')
            ->assertOk()->json('record.data');

        $this->assertSame(['In range', 'Edge'], array_column($rows, 'record'));
    }

    public function test_the_log_is_owner_only(): void
    {
        $permissions = ['vendor-dashboard-view', 'vendor-vehicles-list-view'];
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
        $staff = User::factory()->memberOf($this->shop, $permissions)->create();

        $this->getJson('/api/audit-logs')->assertUnauthorized();
        $this->as($staff)->getJson('/api/audit-logs')->assertForbidden();
    }

    public function test_login_and_logout_are_recorded_on_the_shop_s_log(): void
    {
        $this->postJson('/api/auth/login', ['email' => $this->owner->email, 'password' => 'password'])->assertOk();

        $this->assertDatabaseHas('audit_logs', $this->row('Account', 'login', ['record' => $this->owner->email]));

        $this->as($this->owner)->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseHas('audit_logs', $this->row('Account', 'logout', ['record' => $this->owner->email]));
        $this->assertSame(['login', 'logout'], AuditLog::orderBy('id')->pluck('action')->all());
    }

    public function test_a_failed_login_is_not_recorded(): void
    {
        $this->postJson('/api/auth/login', ['email' => $this->owner->email, 'password' => 'wrong'])->assertUnprocessable();

        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_unpublish_and_archive_record_the_status_change(): void
    {
        $vehicle = $this->makeVehicle($this->shop, 'Own Aqua');

        $this->as($this->owner)->postJson("/api/vehicles/{$vehicle->id}/unpublish")->assertOk();
        $this->as($this->owner)->postJson("/api/vehicles/{$vehicle->id}/archive")->assertOk();

        $logs = AuditLog::where('form', 'Vehicle')->where('record_id', $vehicle->id)->orderBy('id')->get();

        $this->assertCount(2, $logs);
        $this->assertSame($this->shop->id, $logs[0]->shop_id);
        $this->assertSame(['status' => 'published'], $logs[0]->before);
        $this->assertSame(['status' => 'unpublished'], $logs[0]->after);
        $this->assertSame(['status' => 'unpublished'], $logs[1]->before);
        $this->assertSame(['status' => 'archived'], $logs[1]->after);

        $rows = $this->as($this->owner)->getJson('/api/audit-logs')->assertOk()->json('record.data');
        $this->assertSame(['Own Aqua', 'Own Aqua'], array_column($rows, 'record'));
    }

    public function test_a_password_change_is_recorded_without_the_password(): void
    {
        $this->as($this->owner)->putJson('/api/auth/change-password', [
            'current_password' => 'password', 'new_password' => 'new-secret-123', 'new_password_confirmation' => 'new-secret-123',
        ])->assertOk();

        $log = AuditLog::where('form', 'Account')->sole();
        $this->assertSame('edit', $log->action);
        $this->assertSame($this->shop->id, $log->shop_id);
        $this->assertSame(['password' => 'changed'], $log->after);
        $this->assertStringNotContainsString('new-secret-123', json_encode($log->toArray()));
    }
}
