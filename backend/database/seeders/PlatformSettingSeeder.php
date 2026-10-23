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
            ['key' => 'default_owner_response_hours', 'value' => 24, 'group' => 'bookings', 'type' => 'integer',
                'label' => 'Default owner response window (hours)'],
            ['key' => 'default_payment_window_hours', 'value' => 12, 'group' => 'bookings', 'type' => 'integer',
                'label' => 'Default payment window (hours)'],
            ['key' => 'reservation_hold_minutes', 'value' => 30, 'group' => 'bookings', 'type' => 'integer',
                'label' => 'Reservation hold duration (minutes)'],
            ['key' => 'owner_no_response_policy', 'value' => 'auto_reject', 'group' => 'bookings', 'type' => 'string',
                'label' => 'Policy when an owner does not respond in time'],
            ['key' => 'no_show_grace_hours', 'value' => 4, 'group' => 'bookings', 'type' => 'integer',
                'label' => 'No-show grace period (hours)'],
            ['key' => 'payout_dispute_window_days', 'value' => 3, 'group' => 'payouts', 'type' => 'integer',
                'label' => 'Days after completion before a booking is payout-eligible'],
            ['key' => 'min_payout_threshold', 'value' => 5000, 'group' => 'payouts', 'type' => 'decimal',
                'label' => 'Minimum payout threshold (LKR)'],
            ['key' => 'default_commission_percentage', 'value' => 12.00, 'group' => 'commission', 'type' => 'decimal',
                'label' => 'Default platform commission (%)'],
            ['key' => 'vat_rate', 'value' => 0, 'group' => 'tax', 'type' => 'decimal', 'label' => 'VAT / SSCL rate (%)'],
            ['key' => 'review_window_days', 'value' => 14, 'group' => 'reviews', 'type' => 'integer',
                'label' => 'Days a booking stays review-eligible after completion'],
            ['key' => 'featured_listing_limit', 'value' => 12, 'group' => 'listings', 'type' => 'integer',
                'label' => 'Max featured listings shown on the homepage'],
            ['key' => 'maintenance_mode', 'value' => false, 'group' => 'platform', 'type' => 'boolean',
                'label' => 'Maintenance mode'],
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
