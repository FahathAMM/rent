<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Starter', 'slug' => 'starter',
                'monthly_price' => 49, 'yearly_price' => 490,
                'max_users' => 3, 'max_customers' => 100, 'max_invoices' => 100,
                'trial_days' => 14, 'sort_order' => 1,
            ],
            [
                'name' => 'Business', 'slug' => 'business',
                'monthly_price' => 99, 'yearly_price' => 990,
                'max_users' => 10, 'max_customers' => 1000, 'max_invoices' => 1000,
                'trial_days' => 14, 'sort_order' => 2,
            ],
            [
                'name' => 'Professional', 'slug' => 'professional',
                'monthly_price' => 199, 'yearly_price' => 1990,
                'max_users' => null, 'max_customers' => null, 'max_invoices' => null,
                'trial_days' => 14, 'sort_order' => 3,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan + ['status' => 'active']);
        }
    }
}
