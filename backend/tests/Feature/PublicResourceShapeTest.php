<?php

namespace Tests\Feature;

use App\Http\Resources\Public\ShopResource;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Locks in the column allow-list promise of
 * app-doc/marketplace/05-ui-and-api-map.md "Response-shaping rule": a
 * Public resource must never expose a private field, no matter what gets
 * added to the underlying model later. Asserts the ABSENCE of forbidden
 * keys rather than the presence of allowed ones, so a careless future
 * edit that appends a private field to the resource's array is what this
 * is designed to catch.
 */
class PublicResourceShapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_vehicle_resource_never_exposes_private_fields(): void
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create([
            'owner_user_id' => $owner->id,
            'email' => 'private-shop-email@example.com',
            'tax_id' => 'SECRET-TAX-ID',
            'business_registration_no' => 'SECRET-REG-NO',
        ]);
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);

        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Private Test Car',
            'slug' => 'private-test-car', 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2021,
            'registration_number' => 'SECRET-PLATE-123', 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'condition_notes' => 'SECRET internal condition notes',
            'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        $array = (new VehicleResource($vehicle->load('shop', 'category')))->toArray(Request::create('/'));
        $json = json_encode($array);

        $this->assertArrayNotHasKey('registration_number', $array);
        $this->assertArrayNotHasKey('condition_notes', $array);
        $this->assertStringNotContainsString('SECRET-PLATE-123', $json);
        $this->assertStringNotContainsString('SECRET internal condition notes', $json);
        $this->assertStringNotContainsString('private-shop-email@example.com', $json);
    }

    public function test_public_shop_resource_never_exposes_private_fields(): void
    {
        $owner = User::factory()->create();
        $shop = RentalShop::factory()->create([
            'owner_user_id' => $owner->id,
            'email' => 'private-shop-email@example.com',
            'tax_id' => 'SECRET-TAX-ID',
            'business_registration_no' => 'SECRET-REG-NO',
        ]);

        $array = (new ShopResource($shop))->toArray(Request::create('/'));
        $json = json_encode($array);

        $this->assertArrayNotHasKey('email', $array);
        $this->assertArrayNotHasKey('tax_id', $array);
        $this->assertArrayNotHasKey('business_registration_no', $array);
        $this->assertStringNotContainsString('private-shop-email@example.com', $json);
        $this->assertStringNotContainsString('SECRET-TAX-ID', $json);
        $this->assertStringNotContainsString('SECRET-REG-NO', $json);
    }
}
