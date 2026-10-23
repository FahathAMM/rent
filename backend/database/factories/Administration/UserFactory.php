<?php

namespace Database\Factories\Administration;

use App\Models\Administration\User;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Spatie\Permission\Models\Role;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'      => fake()->name(),
            'email'     => fake()->unique()->safeEmail(),
            'password'  => 'password',
            'is_active' => true,
            'phone'     => fake()->phoneNumber(),
        ];
    }

    public function admin(): static
    {
        return $this->role('admin');
    }

    /** Assign an arbitrary tenant/system role (owner, admin, sales, accountant, staff, super-admin). */
    public function role(string $name): static
    {
        return $this->afterCreating(function (User $user) use ($name) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            $user->syncRoles([$role]);
        });
    }

    /** Attach the user to a specific company (or create a new one if none given). */
    public function forCompany(?Company $company = null): static
    {
        return $this->state(fn () => ['company_id' => ($company ?? Company::factory()->create())->id]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
