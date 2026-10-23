<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

class CompanyFactory extends Factory
{
    protected $model = Company::class;

    public function definition(): array
    {
        return [
            'name'       => fake()->company(),
            'legal_name' => fake()->company() . ' LLC',
            'email'      => fake()->unique()->companyEmail(),
            'phone'      => fake()->numerify('+9715########'),
            'trn'        => fake()->numerify('###############'),
            'city'       => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman']),
            'emirate'    => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman']),
            'status'     => 'active',
        ];
    }
}
