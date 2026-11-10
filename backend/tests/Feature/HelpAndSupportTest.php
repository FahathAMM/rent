<?php

namespace Tests\Feature;

use App\Models\HelpItem;
use App\Models\PlatformDetail;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Help & Support in the platform admin: Stay safe, FAQ, Terms & Conditions and Privacy Policy content, and the Contact us details. */
class HelpAndSupportTest extends TestCase
{
    use RefreshDatabase;

    private function admin()
    {
        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}")->withHeader('Accept', 'application/json');
    }

    public function test_pages_start_with_default_content(): void
    {
        foreach (HelpItem::TYPES as $type) {
            $this->assertTrue(HelpItem::where('type', $type)->exists(), "No default {$type} content");
        }
    }

    public function test_admin_creates_edits_and_deletes_a_faq(): void
    {
        $admin = $this->admin();

        $id = $admin->postJson('/api/platform/help-items', [
            'type' => 'faq', 'section' => 'Booking', 'title' => 'Can I extend my rental?', 'body' => 'Ask the shop.',
        ])->assertCreated()->json('data.id');

        $admin->putJson("/api/platform/help-items/{$id}", [
            'type' => 'faq', 'section' => 'Booking', 'title' => 'Can I extend my rental?', 'body' => 'Yes, ask the shop first.',
        ])->assertOk()->assertJsonPath('data.body', 'Yes, ask the shop first.');

        $admin->deleteJson("/api/platform/help-items/{$id}")->assertOk();
        $this->assertDatabaseMissing('help_items', ['id' => $id]);
    }

    public function test_new_item_goes_last_in_its_type(): void
    {
        $admin = $this->admin();
        $id = $admin->postJson('/api/platform/help-items', ['type' => 'warning_sign', 'title' => 'New sign'])->json('data.id');

        $list = $admin->getJson('/api/platform/help-items?type=warning_sign')->assertOk()->json('data');

        $this->assertSame($id, end($list)['id']);
    }

    public function test_required_fields_depend_on_the_type(): void
    {
        $admin = $this->admin();

        $admin->postJson('/api/platform/help-items', ['type' => 'faq', 'title' => 'No answer'])
            ->assertUnprocessable()->assertJsonValidationErrors(['section', 'body']);
        $admin->postJson('/api/platform/help-items', ['type' => 'emergency_contact', 'title' => 'Fire'])
            ->assertUnprocessable()->assertJsonValidationErrors('body');
        $admin->postJson('/api/platform/help-items', ['type' => 'terms', 'title' => 'No text'])
            ->assertUnprocessable()->assertJsonValidationErrors('body');
        $admin->postJson('/api/platform/help-items', ['type' => 'safety_tip', 'title' => 'No section'])
            ->assertUnprocessable()->assertJsonValidationErrors('section');
        $admin->postJson('/api/platform/help-items', ['type' => 'other', 'title' => 'Bad type'])
            ->assertUnprocessable()->assertJsonValidationErrors('type');
    }

    public function test_reorder_changes_the_public_order(): void
    {
        $ids = HelpItem::where('type', 'emergency_contact')->ordered()->pluck('id')->all();

        $this->admin()->postJson('/api/platform/help-items/reorder', ['ids' => array_reverse($ids)])->assertOk();

        $public = collect($this->getJson('/api/public/help-items')->json('data'))->where('type', 'emergency_contact')->pluck('id')->values()->all();
        $this->assertSame(array_reverse($ids), $public);
    }

    public function test_hidden_items_stay_off_the_public_site(): void
    {
        $item = HelpItem::where('type', 'faq')->first();
        $item->update(['is_active' => false]);

        $ids = collect($this->getJson('/api/public/help-items')->assertOk()->json('data'))->pluck('id');

        $this->assertFalse($ids->contains($item->id));
    }

    public function test_terms_reach_the_public_site(): void
    {
        $id = $this->admin()->postJson('/api/platform/help-items', [
            'type' => 'terms', 'title' => 'New clause', 'body' => 'Clause text.',
        ])->assertCreated()->json('data.id');

        $clause = collect($this->getJson('/api/public/help-items')->assertOk()->json('data'))->firstWhere('id', $id);

        $this->assertSame('terms', $clause['type']);
    }

    public function test_rich_text_is_cleaned_before_saving(): void
    {
        $this->admin()->postJson('/api/platform/help-items', [
            'type' => 'privacy', 'title' => 'Clause',
            'body' => '<p onclick="alert(1)">Kept <strong>bold</strong></p><script>alert(1)</script><a href="https://x.test">link</a>',
        ])->assertCreated()->assertJsonPath('data.body', '<p>Kept <strong>bold</strong></p>alert(1)link');
    }

    public function test_rich_text_with_no_words_counts_as_empty(): void
    {
        $this->admin()->postJson('/api/platform/help-items', ['type' => 'terms', 'title' => 'Clause', 'body' => '<p></p>'])
            ->assertUnprocessable()->assertJsonValidationErrors('body');
    }

    public function test_admin_saves_contact_details_and_public_endpoint_returns_them(): void
    {
        PlatformDetail::create(['name' => 'LankaLane']);

        $this->admin()->putJson('/api/platform/support-contact', [
            'support_email' => 'help@lankalane.test',
            'support_phone' => '+94 11 234 5678',
            'support_whatsapp' => '+94 77 123 4567',
            'support_address' => '1 Galle Road, Colombo',
            'support_hours' => 'Mon to Sat, 9:00 AM to 6:00 PM',
        ])->assertOk();

        $this->getJson('/api/platform-details')
            ->assertOk()
            ->assertJsonPath('data.name', 'LankaLane')
            ->assertJsonPath('data.support_email', 'help@lankalane.test')
            ->assertJsonPath('data.support_phone', '+94 11 234 5678')
            ->assertJsonPath('data.support_whatsapp', '+94 77 123 4567')
            ->assertJsonPath('data.support_address', '1 Galle Road, Colombo')
            ->assertJsonPath('data.support_hours', 'Mon to Sat, 9:00 AM to 6:00 PM');
    }

    public function test_blank_contact_field_clears_a_saved_value(): void
    {
        PlatformDetail::create(['name' => 'LankaLane', 'support_phone' => '+94 11 234 5678']);

        $this->admin()->putJson('/api/platform/support-contact', ['support_phone' => ''])->assertOk();

        $this->getJson('/api/platform-details')->assertJsonPath('data.support_phone', null);
    }

    public function test_invalid_contact_email_is_rejected(): void
    {
        PlatformDetail::create(['name' => 'LankaLane']);

        $this->admin()->putJson('/api/platform/support-contact', ['support_email' => 'not-an-email'])
            ->assertUnprocessable()->assertJsonValidationErrors('support_email');
    }

    public function test_managing_help_content_needs_a_platform_admin(): void
    {
        $this->postJson('/api/platform/help-items', ['type' => 'warning_sign', 'title' => 'x'])->assertUnauthorized();
        $this->putJson('/api/platform/support-contact', ['support_email' => 'a@b.co'])->assertUnauthorized();
    }
}
