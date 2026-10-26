<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\ShopMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** POST /vendor/shop-profile/branding - logo + cover banner upload, replace and remove. */
class ShopBrandingUploadTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $owner = User::factory()->create();
        $owner->givePermissionTo(Permission::firstOrCreate(['name' => 'vendor-settings-shop-edit', 'guard_name' => 'web']));
        $owner->givePermissionTo(Permission::firstOrCreate(['name' => 'vendor-settings-shop-view', 'guard_name' => 'web']));
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        ShopMember::create(['shop_id' => $this->shop->id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
    }

    private function asOwner()
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->shop->owner->createToken('test')->plainTextToken)
            ->withHeader('X-Shop-Id', (string) $this->shop->id);
    }

    public function test_owner_can_upload_logo_and_cover(): void
    {
        $res = $this->asOwner()->post('/api/vendor/shop-profile/branding', [
            'logo' => UploadedFile::fake()->image('logo.png', 400, 400),
            'cover_image' => UploadedFile::fake()->image('cover.jpg', 1600, 500),
        ], ['Accept' => 'application/json'])->assertOk();

        $shop = $this->shop->fresh();
        Storage::disk('public')->assertExists($shop->logo);
        Storage::disk('public')->assertExists($shop->cover_image);
        $res->assertJsonPath('data.logo_url', '/storage/' . $shop->logo);

        $this->getJson("/api/public/shops/{$shop->slug}")
            ->assertJsonPath('data.logo', '/storage/' . $shop->logo)
            ->assertJsonPath('data.cover_image', '/storage/' . $shop->cover_image);
    }

    public function test_replacing_deletes_old_file_and_remove_clears_it(): void
    {
        $this->asOwner()->post('/api/vendor/shop-profile/branding', ['logo' => UploadedFile::fake()->image('a.png')], ['Accept' => 'application/json'])->assertOk();
        $first = $this->shop->fresh()->logo;

        $this->asOwner()->post('/api/vendor/shop-profile/branding', ['logo' => UploadedFile::fake()->image('b.png')], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($first);
        $second = $this->shop->fresh()->logo;

        $this->asOwner()->post('/api/vendor/shop-profile/branding', ['remove_logo' => 1], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($second);
        $this->assertNull($this->shop->fresh()->logo);
    }

    public function test_non_image_is_rejected(): void
    {
        $this->asOwner()->post('/api/vendor/shop-profile/branding', [
            'logo' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('logo');
    }

    public function test_owner_saves_custom_policy_sections_shown_on_public_page(): void
    {
        $policies = [
            ['title' => 'Fuel policy', 'body' => 'Full to full.'],
            ['title' => 'Late returns', 'body' => 'LKR 1000 per hour after a 30 minute grace period.'],
        ];

        $this->asOwner()->putJson('/api/vendor/shop-profile', ['name' => $this->shop->name, 'policies' => $policies])->assertOk();

        // assertEquals, not assertJsonPath: a MySQL JSON column re-sorts object keys.
        $this->assertEquals($policies, $this->getJson("/api/public/shops/{$this->shop->slug}")->json('data.policies'));
    }

    public function test_policy_section_needs_title_and_body(): void
    {
        $this->asOwner()->putJson('/api/vendor/shop-profile', ['name' => $this->shop->name, 'policies' => [['title' => '', 'body' => 'x']]])
            ->assertStatus(422)->assertJsonValidationErrors('policies.0.title');
    }
}
