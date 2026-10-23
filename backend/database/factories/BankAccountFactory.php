<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankAccountFactory extends Factory
{
    protected $model = BankAccount::class;

    public function definition(): array
    {
        return [
            'company_id'      => Company::factory(),
            'bank_name'       => fake()->randomElement(['Emirates NBD', 'ADCB', 'Mashreq', 'FAB']),
            'account_name'    => 'Current Account',
            'account_number'  => fake()->numerify('##########'),
            'iban'            => 'AE' . fake()->numerify('##################'),
            'opening_balance' => 0,
            'current_balance' => 0,
            'currency'        => 'AED',
            'status'          => 'active',
        ];
    }
}
