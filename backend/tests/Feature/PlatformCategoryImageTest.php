<?php

namespace Tests\Feature;

use App\Models\SystemAdmin;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** The photo on a home page category tile, uploaded from /platform/categories. */
class PlatformCategoryImageTest extends TestCase
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

    private function createWithImage(): VehicleCategory
    {
        $this->admin()->post('/api/platform/categories', [
            'name' => 'SUV', 'slug' => 'suv', 'is_active' => '1', 'image' => UploadedFile::fake()->image('suv.jpg', 1200, 900),
        ])->assertCreated();

        return VehicleCategory::where('slug', 'suv')->firstOrFail();
    }

    private function update(VehicleCategory $category, array $data)
    {
        return $this->admin()->post("/api/platform/categories/{$category->id}", $data + [
            '_method' => 'PUT', 'name' => $category->name, 'slug' => $category->slug, 'is_active' => '1',
        ]);
    }

    public function test_an_uploaded_photo_reaches_the_public_categories(): void
    {
        $category = $this->createWithImage();

        Storage::disk('public')->assertExists($category->image);
        $this->assertSame('/storage/' . $category->image, $this->getJson('/api/public/categories')->assertOk()->json('data.0.image'));
    }

    public function test_a_category_can_be_saved_without_a_photo(): void
    {
        $this->admin()->post('/api/platform/categories', ['name' => 'Van', 'slug' => 'van', 'is_active' => '1'])->assertCreated();

        $this->assertNull($this->getJson('/api/public/categories')->assertOk()->json('data.0.image'));
    }

    public function test_replacing_a_photo_deletes_the_old_file(): void
    {
        $category = $this->createWithImage();
        $old = $category->image;

        $this->update($category, ['image' => UploadedFile::fake()->image('new.jpg', 1200, 900)])->assertOk();

        Storage::disk('public')->assertMissing($old);
        Storage::disk('public')->assertExists($category->fresh()->image);
    }

    public function test_saving_other_fields_keeps_the_photo(): void
    {
        $category = $this->createWithImage();

        $this->update($category, ['name' => 'SUV & 4x4'])->assertOk();

        $this->assertSame($category->image, $category->fresh()->image);
        Storage::disk('public')->assertExists($category->image);
    }

    public function test_a_photo_can_be_removed(): void
    {
        $category = $this->createWithImage();
        $old = $category->image;

        $this->update($category, ['remove_image' => '1'])->assertOk();

        $this->assertNull($category->fresh()->image);
        Storage::disk('public')->assertMissing($old);
    }

    public function test_deleting_a_category_deletes_its_photo(): void
    {
        $category = $this->createWithImage();

        $this->admin()->deleteJson("/api/platform/categories/{$category->id}")->assertOk();

        Storage::disk('public')->assertMissing($category->image);
    }

    public function test_only_images_up_to_5mb_are_accepted(): void
    {
        $post = fn ($file, $slug) => $this->admin()->post('/api/platform/categories', ['name' => 'X', 'slug' => $slug, 'image' => $file]);

        $post(UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'), 'x-one')->assertJsonValidationErrors('image');
        $post(UploadedFile::fake()->image('big.jpg')->size(6000), 'x-two')->assertJsonValidationErrors('image');
    }
}
