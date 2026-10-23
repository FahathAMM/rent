<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlanFactory extends Factory
{
    protected $model = Plan::class;

    public function definition(): array
    {
        $name = fake()->unique()->randomElement(['Starter', 'Business', 'Professional']);

        return [
            'name'          => $name,
            'slug'          => str($name)->slug() . '-' . fake()->unique()->numberBetween(1, 100000),
            'monthly_price' => fake()->randomElement([49, 99, 199]),
            'yearly_price'  => fake()->randomElement([490, 990, 1990]),
            'max_users'     => fake()->randomElement([3, 10, null]),
            'trial_days'    => 14,
            'status'        => 'active',
            'sort_order'    => 1,
        ];
    }
}
