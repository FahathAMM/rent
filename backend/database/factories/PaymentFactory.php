<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\PaymentMethod;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'company_id'        => Company::factory(),
            'customer_id'       => Customer::factory(),
            'payment_no'        => 'PAY-' . fake()->unique()->numerify('#####'),
            'payment_date'      => now(),
            'amount'            => fake()->randomFloat(2, 100, 5000),
            'payment_method_id' => PaymentMethod::factory(),
        ];
    }
}
