<?php

namespace Database\Factories\Administration;

use App\Models\Administration\User;
use App\Models\RentalShop;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use App\Models\Role;

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

    /** Assign a platform role (customer). */
    public function role(string $name): static
    {
        return $this->afterCreating(function (User $user) use ($name) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            $user->syncRoles([$role]);
        });
    }

    /**
     * Link this user to a shop (a new one if none given): as its owner
     * ('owner' → the shop's shop-owner role), or as staff holding a new shop
     * role with the given permissions. Seed MenuSeeder first so they exist.
     */
    public function memberOf(?RentalShop $shop = null, string|array $role = User::SHOP_ROLE_OWNER): static
    {
        return $this->afterCreating(function (User $user) use ($shop, $role) {
            $shop ??= RentalShop::factory()->create(['owner_user_id' => $user->id]);
            $user->update(['shop_id' => $shop->id]);
            if (is_array($role)) {
                $permissions = $role;
                $role = Role::create(['name' => 'Role ' . Str::random(6), 'guard_name' => 'web', 'shop_id' => $shop->id]);
                $role->syncPermissions($permissions);
            }
            $user->setShopRole($role);
        });
    }

    public function suspended(): static
    {
        return $this->state(['status' => User::STATUS_SUSPENDED]);
    }
}
