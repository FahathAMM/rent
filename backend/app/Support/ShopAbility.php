<?php

namespace App\Support;

/**
 * The shop-scoped ability catalogue - Layer 3 of
 * app-doc/marketplace/03-permissions-model.md. Spatie permissions (Layer 1)
 * gate which NAV ITEMS a role sees; these gate what a specific member may
 * DO at a specific shop, stored per-membership in shop_members.abilities.
 *
 * A shop's `owner` member always passes every check (see
 * ShopMember::hasAbility()) regardless of what is stored in `abilities` -
 * ownership cannot be reduced by editing a JSON column.
 */
enum ShopAbility: string
{
    // Bookings
    case BookingsView = 'bookings.view';
    case BookingsRespond = 'bookings.respond';
    case BookingsCancel = 'bookings.cancel';
    case BookingsModify = 'bookings.modify';

    // Listings
    case ListingsView = 'listings.view';
    case ListingsCreate = 'listings.create';
    case ListingsEdit = 'listings.edit';
    case ListingsPublish = 'listings.publish';
    case ListingsArchive = 'listings.archive';

    // Pricing & calendar
    case PricingManage = 'pricing.manage';
    case AvailabilityManage = 'availability.manage';

    // Operations
    case HandoverConduct = 'handover.conduct';
    case ReturnsConduct = 'returns.conduct';
    case DamageRecord = 'damage.record';
    case InspectionsView = 'inspections.view';

    // Finance
    case FinanceView = 'finance.view';
    case PayoutsView = 'payouts.view';
    case BankDetailsManage = 'bank_details.manage';

    // Shop
    case ShopSettings = 'shop.settings';
    case LocationsManage = 'locations.manage';
    case StaffManage = 'staff.manage';
    case StaffView = 'staff.view';

    // Engagement
    case ReviewsReply = 'reviews.reply';
    case InquiriesRespond = 'inquiries.respond';

    // Reporting
    case ReportsOperational = 'reports.operational';
    case ReportsFinancial = 'reports.financial';

    /**
     * Seeded onto a new membership's `abilities` column at invite time -
     * see app-doc/marketplace/03-permissions-model.md "Role presets". The
     * `owner` preset is intentionally empty: an owner bypasses storage
     * entirely via ShopMember::hasAbility().
     */
    public static function presetFor(string $role): array
    {
        return match ($role) {
            'manager' => [
                self::BookingsView->value, self::BookingsRespond->value, self::BookingsCancel->value,
                self::ListingsView->value, self::ListingsCreate->value, self::ListingsEdit->value,
                self::ListingsPublish->value, self::ListingsArchive->value,
                self::PricingManage->value, self::AvailabilityManage->value,
                self::HandoverConduct->value, self::ReturnsConduct->value, self::DamageRecord->value,
                self::InspectionsView->value,
                self::FinanceView->value, self::PayoutsView->value,
                self::ShopSettings->value, self::LocationsManage->value,
                self::ReviewsReply->value, self::InquiriesRespond->value,
                self::ReportsOperational->value, self::ReportsFinancial->value,
            ],
            'staff' => [
                self::BookingsView->value, self::BookingsRespond->value,
                self::ListingsView->value,
                self::AvailabilityManage->value,
                self::HandoverConduct->value, self::ReturnsConduct->value, self::DamageRecord->value,
                self::InspectionsView->value,
                self::ReviewsReply->value, self::InquiriesRespond->value,
                self::ReportsOperational->value,
            ],
            default => [],
        };
    }
}
