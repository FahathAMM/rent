<?php

namespace Database\Seeders;

use App\Models\VehicleCategory;
use Illuminate\Database\Seeder;

/**
 * Configurable, not hardcoded - platform admins can add/edit categories
 * later (see app-doc/marketplace/02-data-model.md "vehicle_categories").
 * This just seeds the starting set for the Sri Lankan market.
 */
class VehicleCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Car', 'slug' => 'car', 'icon' => 'Car', 'sort_order' => 1],
            ['name' => 'SUV', 'slug' => 'suv', 'icon' => 'Car', 'sort_order' => 2],
            ['name' => 'Van', 'slug' => 'van', 'icon' => 'Truck', 'sort_order' => 3, 'default_min_rental_days' => 1],
            ['name' => 'Minibus', 'slug' => 'minibus', 'icon' => 'Bus', 'sort_order' => 4],
            ['name' => 'Bus', 'slug' => 'bus', 'icon' => 'Bus', 'sort_order' => 5],
            ['name' => 'Cab / Tuk-tuk', 'slug' => 'tuk-tuk', 'icon' => 'CarFront', 'sort_order' => 6],
            ['name' => 'Motorcycle', 'slug' => 'motorcycle', 'icon' => 'Bike', 'sort_order' => 7],
            ['name' => 'Scooter', 'slug' => 'scooter', 'icon' => 'Bike', 'sort_order' => 8],
            ['name' => 'Pickup / Lorry', 'slug' => 'pickup-lorry', 'icon' => 'Truck', 'sort_order' => 9],
            ['name' => 'Luxury', 'slug' => 'luxury', 'icon' => 'Sparkles', 'sort_order' => 10, 'commission_rate' => 15.00],
            ['name' => 'Wedding Car', 'slug' => 'wedding-car', 'icon' => 'Heart', 'sort_order' => 11, 'commission_rate' => 15.00],
            ['name' => 'Self-Drive', 'slug' => 'self-drive', 'icon' => 'Car', 'sort_order' => 12],
        ];

        foreach ($categories as $category) {
            VehicleCategory::updateOrCreate(['slug' => $category['slug']], $category + ['is_active' => true]);
        }
    }
}
