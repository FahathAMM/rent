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
            'name'       => fake()->name(),
            'email'      => fake()->unique()->safeEmail(),
            'password'   => 'password',
            'admin_role' => SystemAdmin::ROLE_ADMIN,
            'is_active'  => true,
        ];
    }

    public function owner(): static
    {
        return $this->state(['admin_role' => SystemAdmin::ROLE_PLATFORM_OWNER]);
    }

    public function finance(): static
    {
        return $this->state(['admin_role' => SystemAdmin::ROLE_FINANCE]);
    }

    public function moderator(): static
    {
        return $this->state(['admin_role' => SystemAdmin::ROLE_MODERATOR]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
