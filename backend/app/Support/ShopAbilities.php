<?php

namespace App\Support;

/**
 * Layer 3's ability catalogue — see
 * app-doc/marketplace/03-permissions-model.md "Ability catalogue" /
 * "Role presets". Single source of truth for both validating
 * shop_members.abilities and rendering the Staff page's checkbox list;
 * the frontend fetches this via GET /vendor/staff/abilities rather than
 * duplicating it.
 */
final class ShopAbilities
{
    public const CATALOGUE = [
        'Bookings' => ['bookings.view', 'bookings.respond', 'bookings.cancel', 'bookings.modify'],
        'Listings' => ['listings.view', 'listings.create', 'listings.edit', 'listings.publish', 'listings.archive'],
        'Pricing & calendar' => ['pricing.manage', 'availability.manage'],
        'Operations' => ['handover.conduct', 'returns.conduct', 'damage.record', 'inspections.view'],
        'Finance' => ['finance.view', 'payouts.view', 'bank_details.manage'],
        'Shop' => ['shop.settings', 'locations.manage', 'staff.manage', 'staff.view'],
        'Engagement' => ['reviews.reply', 'inquiries.respond'],
        'Reporting' => ['reports.operational', 'reports.financial'],
    ];

    /** Seeded into abilities on invite for a given role — editable per member afterward. */
    public const PRESETS = [
        'manager' => [
            'bookings.view', 'bookings.respond', 'bookings.cancel',
            'listings.view', 'listings.create', 'listings.edit', 'listings.publish', 'listings.archive',
            'pricing.manage', 'availability.manage',
            'handover.conduct', 'returns.conduct', 'damage.record', 'inspections.view',
            'finance.view', 'payouts.view',
            'shop.settings',
            'reviews.reply', 'inquiries.respond',
            'reports.financial', 'reports.operational',
        ],
        'staff' => [
            'bookings.view', 'bookings.respond',
            'listings.view',
            'availability.manage',
            'handover.conduct', 'returns.conduct', 'damage.record', 'inspections.view',
            'reviews.reply', 'inquiries.respond',
            'reports.operational',
        ],
    ];

    /** Every valid ability string, flattened — for validation (Rule::in). */
    public static function all(): array
    {
        return array_merge(...array_values(self::CATALOGUE));
    }
}
