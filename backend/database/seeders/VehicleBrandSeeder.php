<?php

namespace Database\Seeders;

use App\Models\VehicleBrand;
use App\Models\VehicleModel;
use App\Models\VehicleVariant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Starting brand -> model -> variant list for the Sri Lankan market.
 * Platform admins manage it (and upload brand logos) from /platform/brands
 * and /platform/vehicle-models. Safe to re-run.
 *
 * Logos: a brand gets storage/app/public/brand-logos/<brand-slug>.<ext>
 * (kept in git) when that file exists. A logo an admin uploaded is kept,
 * unless its file has gone missing. Brands without a file fall back to
 * their initial in the frontend.
 */
class VehicleBrandSeeder extends Seeder
{
    private const LOGO_DIR = 'brand-logos';
    private const LOGO_EXTENSIONS = ['png', 'svg', 'webp', 'jpg', 'jpeg'];

    /** brand => [model => [variants]] */
    private const CATALOGUE = [
        'Toyota' => [
            'Aqua' => ['S', 'G', 'Crossover'], 'Prius' => ['S', 'Touring'], 'Premio' => ['F', 'G', 'X'],
            'Axio' => ['X', 'G'], 'Vitz' => ['F', 'Jewela'], 'Corolla' => [], 'KDH' => ['Standard Roof', 'High Roof'],
            'Hiace' => [], 'Land Cruiser Prado' => ['TX', 'TZ'], 'Coaster' => [], 'Hilux' => [],
        ],
        'Suzuki' => [
            'Wagon R' => ['FX', 'FZ', 'Stingray'], 'Alto' => ['LXI', 'VXR'], 'Swift' => [],
            'Every' => [], 'Spacia' => [], 'Celerio' => [],
        ],
        'Nissan' => ['Caravan' => [], 'Leaf' => [], 'X-Trail' => [], 'Sunny' => [], 'March' => []],
        'Honda' => ['Vezel' => ['X', 'Z', 'RS'], 'Fit' => [], 'Grace' => [], 'CR-V' => [], 'Civic' => []],
        'Mitsubishi' => ['Montero' => [], 'Outlander' => [], 'Lancer' => [], 'L200' => []],
        'Mazda' => ['Axela' => [], 'Demio' => [], 'CX-5' => []],
        'Hyundai' => ['Grand i10' => [], 'Elantra' => [], 'Tucson' => []],
        'Kia' => ['Picanto' => [], 'Sportage' => []],
        'Micro' => ['Panda' => [], 'Kyron' => []],
        'Perodua' => ['Axia' => [], 'Bezza' => []],
        'Tata' => ['Nano' => [], 'Indica' => []],
        'Mahindra' => ['KUV100' => [], 'Bolero' => []],
        'Bajaj' => ['RE Three-wheeler' => [], 'Pulsar' => [], 'CT 100' => []],
        'TVS' => ['King' => [], 'Apache' => [], 'Ntorq' => []],
        'Hero' => ['Splendor' => [], 'Pleasure' => []],
        'Yamaha' => ['FZ' => [], 'Ray ZR' => []],
        'Isuzu' => ['Elf' => [], 'D-Max' => []],
        'Ashok Leyland' => ['Dost' => [], 'Lynx' => []],
        'BMW' => ['3 Series' => [], '5 Series' => [], 'X5' => []],
        'Mercedes-Benz' => ['C-Class' => [], 'E-Class' => []],
        'Audi' => ['A4' => [], 'Q5' => []],
        'Land Rover' => ['Defender' => [], 'Range Rover' => []],
        'Peugeot' => ['3008' => []],
        'DFSK' => ['Glory 580' => [], 'Mini Truck' => []],
    ];

    public function run(): void
    {
        $brandOrder = 0;
        foreach (self::CATALOGUE as $brandName => $models) {
            $brand = VehicleBrand::updateOrCreate(
                ['slug' => Str::slug($brandName)],
                ['name' => $brandName, 'sort_order' => ++$brandOrder, 'is_active' => true],
            );
            $this->attachLogo($brand);

            $modelOrder = 0;
            foreach ($models as $modelName => $variants) {
                $model = VehicleModel::updateOrCreate(
                    ['brand_id' => $brand->id, 'slug' => Str::slug($modelName)],
                    ['name' => $modelName, 'sort_order' => ++$modelOrder, 'is_active' => true],
                );

                foreach ($variants as $i => $variantName) {
                    VehicleVariant::updateOrCreate(
                        ['model_id' => $model->id, 'name' => $variantName],
                        ['sort_order' => $i + 1, 'is_active' => true],
                    );
                }
            }
        }
    }

    /** Point the brand at its bundled logo file, if there is one and it has no (working) logo yet. */
    private function attachLogo(VehicleBrand $brand): void
    {
        $disk = Storage::disk('public');
        if ($brand->logo && $disk->exists($brand->logo)) {
            return;
        }

        foreach (self::LOGO_EXTENSIONS as $ext) {
            $path = self::LOGO_DIR . "/{$brand->slug}.{$ext}";
            if ($disk->exists($path)) {
                $brand->update(['logo' => $path]);
                return;
            }
        }
    }
}
