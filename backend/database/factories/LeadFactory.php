<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeadFactory extends Factory
{
    protected $model = Lead::class;

    public function definition(): array
    {
        return [
            'company_id'      => Company::factory(),
            'lead_no'         => 'LEAD-' . fake()->unique()->numerify('#####'),
            'company_name'    => fake()->optional()->company(),
            'contact_name'    => fake()->name(),
            'email'           => fake()->unique()->safeEmail(),
            'phone'           => fake()->numerify('+9715########'),
            'estimated_value' => fake()->numberBetween(1000, 50000),
            'status'          => 'open',
        ];
    }
}
