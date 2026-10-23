<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Quotation;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuotationFactory extends Factory
{
    protected $model = Quotation::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 500, 20000);
        $tax = round($subtotal * 0.05, 2);

        return [
            'company_id'     => Company::factory(),
            'customer_id'    => Customer::factory(),
            'quotation_no'   => 'QUO-' . fake()->unique()->numerify('#####'),
            'quotation_date' => now()->subDays(fake()->numberBetween(0, 30)),
            'valid_until'    => now()->addDays(14),
            'subtotal'       => $subtotal,
            'discount_amount'=> 0,
            'taxable_amount' => $subtotal,
            'tax_amount'     => $tax,
            'total'          => $subtotal + $tax,
            'status'         => 'draft',
        ];
    }
}
