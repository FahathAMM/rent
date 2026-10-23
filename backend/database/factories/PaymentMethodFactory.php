<?php

namespace Database\Factories;

use App\Models\PaymentMethod;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentMethodFactory extends Factory
{
    protected $model = PaymentMethod::class;

    public function definition(): array
    {
        return [
            'company_id' => null,
            'name'       => fake()->unique()->randomElement(['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Online Payment']),
        ];
    }
}
