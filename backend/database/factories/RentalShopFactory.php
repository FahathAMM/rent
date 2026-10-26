<?php

namespace Database\Factories;

use App\Models\Administration\User;
use App\Models\RentalShop;
use Illuminate\Database\Eloquent\Factories\Factory;

class RentalShopFactory extends Factory
{
    protected $model = RentalShop::class;

    public function definition(): array
    {
        $name = fake()->company() . ' Rentals';

        return [
            'owner_user_id' => User::factory(),
            'name'          => $name,
            'slug'          => str()->slug($name) . '-' . fake()->unique()->numerify('###'),
            'email'         => fake()->unique()->companyEmail(),
            'phone'         => fake()->numerify('07########'),
            'city'          => fake()->randomElement(['Colombo', 'Kandy', 'Galle', 'Negombo', 'Jaffna']),
            'district'      => fake()->randomElement(['Colombo', 'Kandy', 'Galle', 'Gampaha', 'Jaffna']),
            'status'        => 'active',
            'verification_status' => 'verified',
            'is_published'  => true,
            'payout_schedule' => 'monthly',
        ];
    }
}
