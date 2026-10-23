<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExpenseFactory extends Factory
{
    protected $model = Expense::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 50, 3000);
        $taxRate = 5;
        $taxAmount = round($subtotal * $taxRate / 100, 2);

        return [
            'company_id'          => Company::factory(),
            'expense_category_id' => ExpenseCategory::factory(),
            'expense_no'          => 'EXP-' . fake()->unique()->numerify('#####'),
            'expense_date'        => now()->subDays(fake()->numberBetween(0, 60)),
            'vendor_name'         => fake()->company(),
            'subtotal'            => $subtotal,
            'tax_rate'            => $taxRate,
            'tax_amount'          => $taxAmount,
            'total'               => round($subtotal + $taxAmount, 2),
        ];
    }
}
