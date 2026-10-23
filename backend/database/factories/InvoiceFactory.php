<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Invoice;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 500, 20000);
        $tax = round($subtotal * 0.05, 2);
        $total = $subtotal + $tax;

        return [
            'company_id'      => Company::factory(),
            'customer_id'     => Customer::factory(),
            'invoice_no'      => 'INV-' . fake()->unique()->numerify('#####'),
            'invoice_date'    => now()->subDays(fake()->numberBetween(0, 30)),
            'due_date'        => now()->addDays(30),
            'subtotal'        => $subtotal,
            'discount_amount' => 0,
            'taxable_amount'  => $subtotal,
            'tax_amount'      => $tax,
            'total'           => $total,
            'paid_amount'     => 0,
            'balance_amount'  => $total,
            'status'          => 'sent',
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attrs) => [
            'paid_amount'    => $attrs['total'],
            'balance_amount' => 0,
            'status'         => 'paid',
            'paid_at'        => now(),
        ]);
    }
}
