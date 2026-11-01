<?php

namespace Database\Factories;

use App\Models\Administration\User;
use App\Models\RentalShop;
use App\Models\ShopSubscription;
use App\Models\SubscriptionPlan;
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
        ];
    }

    /**
     * A shop with no running plan is locked out of the vendor workspace
     * (EnsureSubscriptionActive), so verified shops get a year of Business
     * — tests of other features shouldn't have to care about plans.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (RentalShop $shop) {
            $planId = SubscriptionPlan::where('code', 'business')->value('id');
            if ($shop->verification_status === RentalShop::VERIFICATION_VERIFIED && $planId) {
                ShopSubscription::create([
                    'shop_id' => $shop->id, 'plan_id' => $planId, 'kind' => ShopSubscription::KIND_GRANTED,
                    'starts_at' => now()->subDay(), 'ends_at' => now()->addYear(), 'note' => 'Test default',
                ]);
            }
        });
    }

    /** No plan at all — an unpaid (locked) shop. */
    public function withoutPlan(): static
    {
        return $this->afterCreating(fn (RentalShop $shop) => ShopSubscription::where('shop_id', $shop->id)->delete());
    }
}
