<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Fixed customer logins (/login), same in local and production.
 * Safe to re-run — existing emails are left untouched.
 *
 *   php artisan db:seed --class=CustomerSeeder --force
 */
class CustomerSeeder extends Seeder
{
    /** [name, email, password, phone|null] */
    private const CUSTOMERS = [
        ['Fahath', 'fahath@cus.com', 'fahath@123', '0752388923'],
        ['Rasan', 'rasan@cus.com', 'rasa@123', '0752388888'],
        ['Ranoos', 'ranoos@cus.com', 'ranoos@123', null],
    ];

    public function run(): void
    {
        $created = 0;

        foreach (self::CUSTOMERS as [$name, $email, $password, $phone]) {
            $customer = Customer::firstOrCreate(['email' => $email], [
                'name' => $name,
                'password' => Hash::make($password),
                'phone' => $phone,
                'status' => Customer::STATUS_ACTIVE,
                'registration_source' => 'seeder',
                'terms_accepted_at' => now(),
            ]);

            if ($customer->wasRecentlyCreated) {
                $customer->forceFill(['email_verified_at' => now()])->save();
                $created++;
            }
        }

        $this->command?->info("Seeded {$created} customers (" . count(self::CUSTOMERS) . ' defined).');
    }
}
