<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\LeadSource;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeadSourceFactory extends Factory
{
    protected $model = LeadSource::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name'       => fake()->unique()->randomElement(['Website', 'Google', 'Facebook', 'Instagram', 'Referral', 'WhatsApp', 'Walk-in', 'Cold Call']),
        ];
    }
}
