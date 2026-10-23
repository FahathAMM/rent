<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    public function definition(): array
    {
        return [
            'company_id'    => Company::factory(),
            'plan_id'       => Plan::factory(),
            'status'        => 'trial',
            'starts_at'     => now(),
            'trial_ends_at' => now()->addDays(14),
        ];
    }

    public function active(): static
    {
        return $this->state(fn () => ['status' => 'active', 'trial_ends_at' => null]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['status' => 'trial', 'trial_ends_at' => now()->subDay()]);
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => 'cancelled', 'ends_at' => now()]);
    }
}
