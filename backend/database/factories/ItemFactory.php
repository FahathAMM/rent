<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

class ItemFactory extends Factory
{
    protected $model = Item::class;

    public function definition(): array
    {
        $type = fake()->randomElement(['product', 'service']);
        $purchase = fake()->randomFloat(2, 10, 500);

        return [
            'company_id'     => Company::factory(),
            'type'           => $type,
            'sku'            => $type === 'product' ? strtoupper(fake()->bothify('SKU-####')) : null,
            'name'           => $type === 'product' ? fake()->words(3, true) : fake()->catchPhrase(),
            'description'    => fake()->optional()->sentence(),
            'purchase_price' => $purchase,
            'selling_price'  => round($purchase * fake()->randomFloat(2, 1.2, 2), 2),
            'tax_rate'       => 5.00,
            'status'         => 'active',
        ];
    }
}
