<?php

namespace Database\Factories\Administration;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\ShopMember;
use Illuminate\Database\Eloquent\Factories\Factory;
use Spatie\Permission\Models\Role;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'     => fake()->name(),
            'email'    => fake()->unique()->safeEmail(),
            'password' => 'password',
            'status'   => User::STATUS_ACTIVE,
            'phone'    => fake()->numerify('07########'),
        ];
    }

    /** Assign a marketplace role (customer, shop-owner, shop-staff). */
    public function role(string $name): static
    {
        return $this->afterCreating(function (User $user) use ($name) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            $user->syncRoles([$role]);
        });
    }

    /** Create (or attach to) a shop membership for this user. */
    public function memberOf(?RentalShop $shop = null, string $role = ShopMember::ROLE_OWNER): static
    {
        return $this->afterCreating(function (User $user) use ($shop, $role) {
            ShopMember::create([
                'shop_id' => ($shop ?? RentalShop::factory()->create())->id,
                'user_id' => $user->id,
                'role'    => $role,
                'status'  => ShopMember::STATUS_ACTIVE,
                'accepted_at' => now(),
            ]);
        });
    }

    public function suspended(): static
    {
        return $this->state(['status' => User::STATUS_SUSPENDED]);
    }
}
