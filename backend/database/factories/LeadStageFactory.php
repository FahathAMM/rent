<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\LeadStage;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeadStageFactory extends Factory
{
    protected $model = LeadStage::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name'       => fake()->unique()->randomElement(['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost']),
            'position'   => fake()->numberBetween(1, 7),
            'is_won'     => false,
            'is_lost'    => false,
        ];
    }

    public function won(): static
    {
        return $this->state(['name' => 'Won', 'is_won' => true, 'is_lost' => false]);
    }

    public function lost(): static
    {
        return $this->state(['name' => 'Lost', 'is_won' => false, 'is_lost' => true]);
    }
}
