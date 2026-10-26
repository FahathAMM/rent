<?php

namespace Tests\Feature;

use App\Models\HeroSlide;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Platform-managed home page hero slides: CRUD + reorder, and only active ones reach the public endpoint. */
class HeroSlideTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;
    }

    private function admin()
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}")->withHeader('Accept', 'application/json');
    }

    private function createSlide(array $overrides = [])
    {
        return $this->admin()->post('/api/platform/hero-slides', $overrides + [
            'title' => 'Explore the hill country',
            'subtitle' => 'SUVs ready for Ella and Nuwara Eliya',
            'image' => UploadedFile::fake()->image('hero.jpg', 1600, 700),
            'link_url' => '/browse?category_id=3',
            'link_label' => 'See SUVs',
            'is_active' => '1',
        ]);
    }

    public function test_admin_creates_updates_and_deletes_a_slide(): void
    {
        $id = $this->createSlide()->assertCreated()->json('data.id');
        $slide = HeroSlide::findOrFail($id);
        Storage::disk('public')->assertExists($slide->image);
        $oldImage = $slide->image;

        $this->admin()->post("/api/platform/hero-slides/{$id}", [
            '_method' => 'PUT',
            'title' => 'New headline',
            'image' => UploadedFile::fake()->image('new.jpg', 1600, 700),
        ])->assertOk()->assertJsonPath('data.title', 'New headline');

        Storage::disk('public')->assertMissing($oldImage);
        $newImage = HeroSlide::findOrFail($id)->image;

        $this->admin()->deleteJson("/api/platform/hero-slides/{$id}")->assertOk();
        Storage::disk('public')->assertMissing($newImage);
        $this->assertDatabaseMissing('hero_slides', ['id' => $id]);
    }

    public function test_public_endpoint_returns_only_active_slides_in_order(): void
    {
        $a = $this->createSlide(['title' => 'A'])->json('data.id');
        $b = $this->createSlide(['title' => 'B'])->json('data.id');
        $this->createSlide(['title' => 'Hidden', 'is_active' => '0']);

        $this->admin()->postJson('/api/platform/hero-slides/reorder', ['ids' => [$b, $a]])->assertOk();

        $this->getJson('/api/public/hero-slides')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.title', 'B')
            ->assertJsonPath('data.1.title', 'A');
    }

    public function test_image_is_required_and_link_must_be_a_path_or_http_url(): void
    {
        $this->admin()->post('/api/platform/hero-slides', ['title' => 'No image'])
            ->assertStatus(422)->assertJsonValidationErrors('image');

        $this->createSlide(['link_url' => 'javascript:alert(1)'])
            ->assertStatus(422)->assertJsonValidationErrors('link_url');

        $this->createSlide(['link_url' => '//evil.example'])
            ->assertStatus(422)->assertJsonValidationErrors('link_url');
    }

    public function test_seeder_adds_default_slides_once_using_bundled_images(): void
    {
        $this->seed(\Database\Seeders\HeroSlideSeeder::class);
        $this->seed(\Database\Seeders\HeroSlideSeeder::class);

        $this->assertSame(6, HeroSlide::count());
        $this->getJson('/api/public/hero-slides')
            ->assertJsonCount(6, 'data')
            ->assertJsonPath('data.0.title', 'Rent any vehicle, anywhere in Sri Lanka')
            ->assertJsonPath('data.0.image_url', '/images/hero/saloon-highway.webp');
    }

    public function test_deleting_a_default_slide_never_touches_storage(): void
    {
        $this->seed(\Database\Seeders\HeroSlideSeeder::class);
        $slide = HeroSlide::ordered()->first();
        Storage::disk('public')->put('images/hero/saloon-highway.webp', 'x');

        $this->admin()->deleteJson("/api/platform/hero-slides/{$slide->id}")->assertOk();

        Storage::disk('public')->assertExists('images/hero/saloon-highway.webp');
    }

    public function test_guests_cannot_manage_slides(): void
    {
        $this->postJson('/api/platform/hero-slides', ['title' => 'x'])->assertUnauthorized();
    }
}
