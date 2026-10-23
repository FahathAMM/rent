<?php

namespace Database\Factories;

use App\Models\ExpenseCategory;
use App\Models\RentalShop;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExpenseCategoryFactory extends Factory
{
    protected $model = ExpenseCategory::class;

    public function definition(): array
    {
        return [
            'shop_id' => RentalShop::factory(),
            'name'    => fake()->unique()->randomElement([
                'Fuel', 'Service & Maintenance', 'Insurance', 'Revenue Licence',
                'Emission Test', 'Tyres', 'Cleaning', 'Parking', 'Fines', 'Other',
            ]),
        ];
    }
}
