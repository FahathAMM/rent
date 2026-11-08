<?php

namespace App\Queries;

use App\Models\SaleEnquiry;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * A buyer's enquiries span whichever shops they asked, so — like
 * CustomerBookingQuery — shop-scoping is the wrong question; ownership by
 * customer_id is. Sanctioned ShopScope bypass; see
 * tests/Feature/PublicScopeBoundaryTest.php.
 */
class CustomerSaleQuery
{
    public static function forCustomer(int $customerId): Builder
    {
        return SaleEnquiry::withoutGlobalScope(ShopScope::class)
            ->where('customer_id', $customerId)
            ->with([
                'shop:id,name,slug,city,logo',
                'vehicle' => fn ($q) => $q->withoutGlobalScope(ShopScope::class)->with(['saleDetail', 'images' => fn ($i) => $i->orderBy('sort_order')->with('attachment')]),
                'sale' => fn ($q) => $q->withoutGlobalScope(ShopScope::class),
            ])
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('sender_type', SaleEnquiry::SENDER_SHOP)->whereNull('read_at')]);
    }

    /** The customer's open enquiry on this car, if any: asking again adds to it. */
    public static function openOn(int $customerId, int $vehicleId): ?SaleEnquiry
    {
        return SaleEnquiry::withoutGlobalScope(ShopScope::class)
            ->where('customer_id', $customerId)->where('vehicle_id', $vehicleId)->open()->first();
    }

    public static function find(int $customerId, string $reference): ?SaleEnquiry
    {
        return self::forCustomer($customerId)->where('reference', $reference)->first();
    }
}
