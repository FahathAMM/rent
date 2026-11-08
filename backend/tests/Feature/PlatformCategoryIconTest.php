<?php

namespace Tests\Feature;

use App\Models\SystemAdmin;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** Categories on /platform/categories carry an icon key for the home page grid; there is no photo upload. */
class PlatformCategoryIconTest extends TestCase
{
    use RefreshDatabase;

    private function admin()
    {
        $token = SystemAdmin::factory()->create()->createToken('t')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}")->withHeader('Accept', 'application/json');
    }

    public function test_icon_is_saved_on_create_and_update_as_json(): void
    {
        $admin = $this->admin();

        $id = $admin->postJson('/api/platform/categories', ['name' => 'Tuk-tuk', 'slug' => 'tuk-tuk', 'icon' => 'MdElectricRickshaw', 'is_active' => true])
            ->assertCreated()->json('data.id');
        $this->assertSame('MdElectricRickshaw', VehicleCategory::find($id)->icon);

        $admin->putJson("/api/platform/categories/{$id}", ['name' => 'Tuk-tuk', 'slug' => 'tuk-tuk', 'icon' => null])->assertOk();
        $this->assertNull(VehicleCategory::find($id)->icon);

        $admin->putJson("/api/platform/categories/{$id}", ['name' => 'Tuk-tuk', 'slug' => 'tuk-tuk', 'icon' => '<svg onload=x>'])
            ->assertJsonValidationErrors('icon');
    }

    public function test_category_has_no_image(): void
    {
        $this->assertFalse(Schema::hasColumn('vehicle_categories', 'image'));

        VehicleCategory::create(['name' => 'Van', 'slug' => 'van', 'icon' => 'FaVanShuttle', 'is_active' => true]);

        $tile = $this->getJson('/api/public/categories')->assertOk()->json('data.0');
        $this->assertSame('FaVanShuttle', $tile['icon']);
        $this->assertArrayNotHasKey('image', $tile);
    }
}
