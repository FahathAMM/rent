<?php

namespace Database\Factories;

use App\Models\SystemAdmin;
use Illuminate\Database\Eloquent\Factories\Factory;

class SystemAdminFactory extends Factory
{
    protected $model = SystemAdmin::class;

    public function definition(): array
    {
        return [
            'name'     => fake()->name(),
            'email'    => fake()->unique()->safeEmail(),
            'password' => 'password',
            'role'     => 'platform_admin',
            'status'   => 'active',
        ];
    }

    public function owner(): static
    {
        return $this->state(['role' => 'platform_owner']);
    }

    public function inactive(): static
    {
        return $this->state(['status' => 'inactive']);
    }
}
