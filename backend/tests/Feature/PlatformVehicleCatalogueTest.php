<?php

namespace Tests\Feature;

use App\Models\SystemAdmin;
use App\Models\VehicleBrand;
use App\Models\VehicleModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Platform CRUD for the vehicle hierarchy - brands (multipart, with logo),
 * models, variants and colours. Real bearer tokens, like the other
 * platform tests.
 */
class PlatformVehicleCatalogueTest extends TestCase
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

    public function test_brand_logo_size_type_and_dimensions_are_validated(): void
    {
        $post = fn ($logo, $slug) => $this->admin()->post('/api/platform/brands', ['name' => 'X', 'slug' => $slug, 'logo' => $logo]);

        $post(UploadedFile::fake()->image('tiny.png', 32, 32), 'tiny')
            ->assertStatus(422)->assertJsonValidationErrors(['logo' => 'between 64×64 and 2000×2000']);

        $post(UploadedFile::fake()->image('huge.png', 2400, 800), 'huge')
            ->assertStatus(422)->assertJsonValidationErrors('logo');

        $post(UploadedFile::fake()->image('heavy.png', 400, 400)->size(3000), 'heavy')
            ->assertStatus(422)->assertJsonValidationErrors(['logo' => '2 MB']);

        $post(UploadedFile::fake()->create('logo.svg', 4, 'image/svg+xml'), 'svg')
            ->assertStatus(422)->assertJsonValidationErrors('logo');

        $post(UploadedFile::fake()->image('ok.webp', 400, 400), 'ok')->assertCreated();
    }

    public function test_a_brand_can_be_created_with_a_logo_listed_updated_and_deleted(): void
    {
        $created = $this->admin()->post('/api/platform/brands', [
            'name' => 'Toyota', 'slug' => 'toyota', 'sort_order' => '1', 'is_active' => '1',
            'logo' => UploadedFile::fake()->image('toyota.png', 64, 64),
        ])->assertCreated()->assertJsonPath('data.name', 'Toyota');

        $brand = VehicleBrand::findOrFail($created->json('data.id'));
        Storage::disk('public')->assertExists($brand->logo);
        $this->assertSame('/storage/' . $brand->logo, $created->json('data.logo_url'));

        $this->admin()->get('/api/platform/brands')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Toyota')
            ->assertJsonPath('data.0.vehicles_count', 0);

        // Multipart update goes through POST + _method=PUT, exactly like the frontend.
        $oldLogo = $brand->logo;
        $this->admin()->post("/api/platform/brands/{$brand->id}", [
            '_method' => 'PUT', 'name' => 'Toyota Motors', 'slug' => 'toyota', 'sort_order' => '2', 'is_active' => '0',
            'remove_logo' => '1',
        ])->assertOk()->assertJsonPath('data.name', 'Toyota Motors')->assertJsonPath('data.logo_url', null);
        Storage::disk('public')->assertMissing($oldLogo);
        $this->assertFalse($brand->fresh()->is_active);

        $this->admin()->delete("/api/platform/brands/{$brand->id}")->assertOk();
        $this->assertDatabaseMissing('vehicle_brands', ['id' => $brand->id]);
    }

    public function test_brand_slugs_must_be_unique(): void
    {
        VehicleBrand::create(['name' => 'Toyota', 'slug' => 'toyota']);

        $this->admin()->post('/api/platform/brands', ['name' => 'Toyota 2', 'slug' => 'toyota'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
    }

    public function test_models_variants_and_colours_crud(): void
    {
        $brand = VehicleBrand::create(['name' => 'Toyota', 'slug' => 'toyota']);

        $model = $this->admin()->postJson('/api/platform/vehicle-models', ['brand_id' => $brand->id, 'name' => 'Aqua', 'slug' => 'aqua'])
            ->assertCreated()->json('data');
        $this->admin()->putJson("/api/platform/vehicle-models/{$model['id']}", ['brand_id' => $brand->id, 'name' => 'Aqua Hybrid', 'slug' => 'aqua'])
            ->assertOk()->assertJsonPath('data.name', 'Aqua Hybrid');
        $this->admin()->getJson("/api/platform/vehicle-models?brand_id={$brand->id}")
            ->assertOk()->assertJsonPath('data.0.brand.name', 'Toyota');

        $variant = $this->admin()->postJson('/api/platform/vehicle-variants', ['model_id' => $model['id'], 'name' => 'G'])
            ->assertCreated()->json('data');
        $this->admin()->postJson('/api/platform/vehicle-variants', ['model_id' => $model['id'], 'name' => 'G'])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->admin()->getJson("/api/platform/vehicle-variants?model_id={$model['id']}")
            ->assertOk()->assertJsonCount(1, 'data');
        $this->admin()->deleteJson("/api/platform/vehicle-variants/{$variant['id']}")->assertOk();

        $colour = $this->admin()->postJson('/api/platform/vehicle-colours', ['name' => 'White', 'slug' => 'white', 'hex' => '#FFFFFF'])
            ->assertCreated()->json('data');
        $this->admin()->postJson('/api/platform/vehicle-colours', ['name' => 'Bad', 'slug' => 'bad', 'hex' => 'white'])
            ->assertUnprocessable()->assertJsonValidationErrors('hex');
        $this->admin()->deleteJson("/api/platform/vehicle-colours/{$colour['id']}")->assertOk();

        $this->admin()->deleteJson("/api/platform/vehicle-models/{$model['id']}")->assertOk();
        $this->assertDatabaseMissing('vehicle_models', ['id' => $model['id']]);
    }

    public function test_the_public_endpoints_list_only_active_entries(): void
    {
        $brand = VehicleBrand::create(['name' => 'Toyota', 'slug' => 'toyota']);
        VehicleBrand::create(['name' => 'Hidden', 'slug' => 'hidden', 'is_active' => false]);
        VehicleModel::create(['brand_id' => $brand->id, 'name' => 'Aqua', 'slug' => 'aqua']);
        VehicleModel::create(['brand_id' => $brand->id, 'name' => 'Retired', 'slug' => 'retired', 'is_active' => false]);

        $this->getJson('/api/public/brands')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Toyota');
        $this->getJson("/api/public/models?brand_id={$brand->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Aqua');
    }
}
