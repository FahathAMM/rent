<?php

namespace Database\Seeders;

use App\Models\VehicleColour;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** Starting colour list - managed from /platform/vehicle-colours. Safe to re-run. */
class VehicleColourSeeder extends Seeder
{
    public function run(): void
    {
        $colours = [
            'White' => '#FFFFFF', 'Pearl White' => '#F4F1EA', 'Black' => '#111111', 'Silver' => '#C0C0C0',
            'Grey' => '#808080', 'Red' => '#C62828', 'Maroon' => '#6A1B1A', 'Blue' => '#1E4FD8',
            'Dark Blue' => '#1A2A57', 'Green' => '#2E7D32', 'Brown' => '#6D4C41', 'Beige' => '#D8C8A8',
            'Gold' => '#C9A227', 'Yellow' => '#F2C200', 'Orange' => '#EF6C00', 'Other' => null,
        ];

        $order = 0;
        foreach ($colours as $name => $hex) {
            VehicleColour::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'hex' => $hex, 'sort_order' => ++$order, 'is_active' => true],
            );
        }
    }
}
