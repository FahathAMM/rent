<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanySetting;
use Illuminate\Database\Eloquent\Factories\Factory;

class CompanySettingFactory extends Factory
{
    protected $model = CompanySetting::class;

    public function definition(): array
    {
        return [
            'company_id'             => Company::factory(),
            'invoice_prefix'         => 'INV',
            'expense_prefix'         => 'EXP',
            'next_invoice_number'    => 1,
            'next_expense_number'    => 1,
        ];
    }
}
