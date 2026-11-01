<?php

namespace Database\Seeders;

use App\Models\PlatformSetting;
use Illuminate\Database\Seeder;

/**
 * Seeded defaults for app-doc/marketplace/02-data-model.md section 7.
 * allow_unapproved_owner_publishing stays false unless a platform admin
 * explicitly flips it - see app-doc/marketplace/01-phase1-architecture.md
 * section 3.1.
 */
class PlatformSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'allow_unapproved_owner_publishing', 'value' => false, 'group' => 'listings', 'type' => 'boolean',
                'label' => 'Allow unapproved owners to publish listings'],
            ['key' => 'owner_no_response_policy', 'value' => 'auto_reject', 'group' => 'bookings', 'type' => 'string',
                'label' => 'Policy when an owner does not respond in time'],
            ['key' => 'no_show_grace_hours', 'value' => 4, 'group' => 'bookings', 'type' => 'integer',
                'label' => 'No-show grace period (hours)'],
        ];

        foreach ($settings as $setting) {
            $value = $setting['value'];
            unset($setting['value']);

            PlatformSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting + ['value' => ['value' => $value]]
            );
        }
    }
}
