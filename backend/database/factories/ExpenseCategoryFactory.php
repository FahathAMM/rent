<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\ExpenseCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExpenseCategoryFactory extends Factory
{
    protected $model = ExpenseCategory::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name'       => fake()->unique()->randomElement(['Office Rent', 'Fuel', 'Salary', 'Internet', 'Marketing', 'Transport', 'Utilities', 'Other']),
        ];
    }
}
