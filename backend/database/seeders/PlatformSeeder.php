<?php

namespace Database\Seeders;

use App\Models\PlatformDetail;
use App\Models\SystemAdmin;
use Database\Seeders\Concerns\SeedsPasswords;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Every platform (SaaS admin) row the app needs to boot, in one place: the
 * initial Platform Owner account and the default platform branding row.
 * Safe to run in production — the admin credentials come from
 * PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD; with no password set,
 * production gets a random one (printed once), never a committed default.
 */
class PlatformSeeder extends Seeder
{
    use SeedsPasswords;

    public function run(): void
    {
        $this->seedPlatformAdmin();
        $this->seedPlatformDetail();
    }

    private function seedPlatformAdmin(): void
    {
        $email = env('PLATFORM_ADMIN_EMAIL', 'admin@example.com');
        if (SystemAdmin::where('email', $email)->exists()) {
            return; // never touch an existing owner's password
        }

        SystemAdmin::create(
            [
                'email'      => $email,
                'name'       => 'Platform Owner',
                'password'   => Hash::make($this->seedPassword('PLATFORM_ADMIN_PASSWORD', 'change-me-dev-only', 'Platform owner ' . $email)),
                'admin_role' => 'platform_owner',
                'is_active'  => true,
            ]
        );
    }

    private function seedPlatformDetail(): void
    {
        PlatformDetail::firstOrCreate([], [
            'name'    => 'LankaLane',
            'tagline' => 'Rent or buy a vehicle, anywhere in Sri Lanka.',
        ]);
    }
}
