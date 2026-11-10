<?php

namespace Tests\Feature;

use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Things waiting for the platform reach every active admin's bell (PlatformNotifier). */
class PlatformNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_admins_are_notified_and_can_read_their_notifications(): void
    {
        $admin = SystemAdmin::factory()->create();
        $other = SystemAdmin::factory()->moderator()->create();
        $inactive = SystemAdmin::factory()->inactive()->create();
        $shop = RentalShop::factory()->create();

        app(ReportService::class)->create(null, 'someone@example.com', 'shop', $shop->id, 'fraud', 'Took a deposit and vanished.');

        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame(1, $other->notifications()->count());
        $this->assertSame(0, $inactive->notifications()->count());

        $list = $this->actingAs($admin, 'platform')->getJson('/api/platform/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('record.data.0.data.type', 'abuse_report_submitted')
            ->assertJsonPath('record.data.0.data.action_url', '/platform/abuse-reports');

        $id = $list->json('record.data.0.id');
        $this->actingAs($admin, 'platform')->postJson("/api/platform/notifications/{$id}/read")->assertOk();
        $this->actingAs($admin, 'platform')->getJson('/api/platform/notifications')->assertJsonPath('unread_count', 0);

        // Reading is per admin, and nobody can mark someone else's notification.
        $this->assertSame(1, $other->unreadNotifications()->count());
        $otherId = $other->notifications()->value('id');
        $this->actingAs($admin, 'platform')->postJson("/api/platform/notifications/{$otherId}/read")->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->actingAs($other, 'platform')->postJson('/api/platform/notifications/read-all')->assertOk();
        $this->assertSame(0, $other->unreadNotifications()->count());
    }

    public function test_notifications_need_a_platform_session(): void
    {
        $this->getJson('/api/platform/notifications')->assertUnauthorized();
    }
}
