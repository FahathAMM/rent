<?php

namespace Database\Seeders;

use App\Models\HeroSlide;
use Illuminate\Database\Seeder;

/**
 * Default home page hero slides - the stock photos and headlines the hero
 * shipped with before slides became platform-managed. Images point at the
 * frontend's bundled copies (frontend/public/images/hero), so nothing is
 * uploaded. Only seeds an empty table: once an admin has slides of their
 * own (or has deleted these), re-running never brings them back.
 */
class HeroSlideSeeder extends Seeder
{
    private const DEFAULTS = [
        [
            'image' => '/images/hero/saloon-highway.webp',
            'title' => 'Rent any vehicle, anywhere in Sri Lanka',
            'subtitle' => 'Compare vehicles from registered rental shops, book in minutes, and pick up wherever suits you.',
            'link_url' => '/browse',
            'link_label' => 'Browse vehicles',
        ],
        ['image' => '/images/hero/suv-desert.webp', 'title' => 'SUVs for the long road'],
        ['image' => '/images/hero/city-hatchback.webp', 'title' => 'Easy city cars'],
        ['image' => '/images/hero/coupe-sunset.webp', 'title' => 'Something special for the weekend'],
        ['image' => '/images/hero/suv-mountain.webp', 'title' => 'Ready for the hill country'],
        ['image' => '/images/hero/sports-front.webp', 'title' => 'Drive what you love'],
    ];

    public function run(): void
    {
        if (HeroSlide::exists()) {
            return;
        }

        foreach (self::DEFAULTS as $i => $slide) {
            HeroSlide::create($slide + ['sort_order' => $i, 'is_active' => true]);
        }
    }
}
