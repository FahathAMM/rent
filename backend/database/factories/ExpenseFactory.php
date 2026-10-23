<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\RentalShop;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExpenseFactory extends Factory
{
    protected $model = Expense::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 500, 15000);
        $taxRate = 0;
        $taxAmount = round($subtotal * $taxRate / 100, 2);

        return [
            'shop_id'             => RentalShop::factory(),
            'expense_category_id' => ExpenseCategory::factory(),
            'expense_number'      => 'EXP-' . fake()->unique()->numerify('#####'),
            'expense_date'        => now()->subDays(fake()->numberBetween(0, 60)),
            'expense_type'        => fake()->randomElement(['fuel', 'service', 'repair', 'insurance', 'cleaning', 'other']),
            'vendor_name'         => fake()->company(),
            'subtotal'            => $subtotal,
            'tax_rate'            => $taxRate,
            'tax_amount'          => $taxAmount,
            'total'               => round($subtotal + $taxAmount, 2),
        ];
    }
}
