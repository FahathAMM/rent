<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    public function definition(): array
    {
        $type = fake()->randomElement(['individual', 'company']);

        return [
            'company_id'          => Company::factory(),
            'supplier_code'       => 'SUP-' . fake()->unique()->numerify('#####'),
            'type'                => $type,
            'company_name'        => $type === 'company' ? fake()->company() : null,
            'first_name'          => fake()->firstName(),
            'last_name'           => fake()->lastName(),
            'email'               => fake()->unique()->safeEmail(),
            'phone'               => fake()->numerify('+9714#######'),
            'mobile'              => fake()->numerify('+9715########'),
            'trn'                 => fake()->numerify('1###############'),
            'city'                => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah']),
            'emirate'             => fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah']),
            'payment_terms_days'  => fake()->randomElement([0, 15, 30, 45, 60]),
            'status'              => 'active',
        ];
    }
}
