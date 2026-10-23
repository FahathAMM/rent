<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        $type = fake()->randomElement(['individual', 'company']);

        return [
            'company_id'          => Company::factory(),
            'customer_code'       => 'CUS-' . fake()->unique()->numerify('#####'),
            'type'                => $type,
            'company_name'        => $type === 'company' ? fake()->company() : null,
            'first_name'          => fake()->firstName(),
            'last_name'           => fake()->lastName(),
            'email'               => fake()->unique()->safeEmail(),
            'phone'               => fake()->numerify('+9714#######'),
            'mobile'              => fake()->numerify('+9715########'),
            'city'                => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah']),
            'emirate'             => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah']),
            'credit_limit'        => fake()->randomElement([0, 5000, 10000, 25000]),
            'payment_terms_days'  => fake()->randomElement([0, 15, 30, 45, 60]),
            'status'              => 'active',
        ];
    }
}
