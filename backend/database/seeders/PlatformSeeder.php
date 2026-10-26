<?php

namespace Database\Seeders;

use App\Models\PlatformDetail;
use App\Models\SystemAdmin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Every platform (SaaS admin) row the app needs to boot, in one place: the
 * initial Platform Owner account and the default platform branding row.
 * Safe to run in production — the admin credentials come from env vars
 * (falling back to a clearly-marked dev-only default) rather than being
 * hardcoded, so a real deployment overrides them via .env instead of
 * shipping a fixed secret.
 */
class PlatformSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedPlatformAdmin();
        $this->seedPlatformDetail();
    }

    private function seedPlatformAdmin(): void
    {
        SystemAdmin::firstOrCreate(
            ['email' => env('PLATFORM_ADMIN_EMAIL', 'admin@example.com')],
            [
                'name'       => 'fahathammex90@gmail.com',
                'password'   => Hash::make(env('PLATFORM_ADMIN_PASSWORD', 'Fahath@321')),
                'admin_role' => 'platform_owner',
                'is_active'  => true,
            ]
        );
    }

    private function seedPlatformDetail(): void
    {
        PlatformDetail::firstOrCreate([], [
            'name'    => 'LankaLane',
            'tagline' => 'Rent any vehicle, anywhere in Sri Lanka.',
        ]);
    }
}
