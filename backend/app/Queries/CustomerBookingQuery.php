<?php

namespace App\Queries;

use App\Models\Booking;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * A customer's own bookings necessarily span multiple shops (different
 * vehicles, different owners), so ShopScope's shop-scoping is the wrong
 * question entirely for this read - and its "authenticated but no shop
 * context -> fail closed" branch (see Scopes\ShopScope's docblock) would
 * otherwise return zero rows for every customer, since a customer never
 * sets X-Shop-Id. This is the second sanctioned ShopScope bypass
 * location, alongside App\Queries\Public* - see
 * tests/Feature/PublicScopeBoundaryTest.php - narrowed to customer_id
 * instead of being unrestricted.
 *
 * Bypassing the scope on the Booking query itself is NOT enough:
 * ->with('vehicle') / ->load('vehicle') eager-loads Vehicle through a
 * fresh query that reapplies Vehicle's OWN ShopScope independently (a
 * parent builder's withoutGlobalScope never propagates into a relation
 * load), and Vehicle/Location are both BelongsToShop too - so the
 * relation fails closed and silently resolves to null even though the
 * booking row itself loaded fine. withRelations() is the one place that
 * eager-loads them with the same bypass, so callers never have to
 * remember this per call site.
 */
class CustomerBookingQuery
{
    public static function base(int $customerId): Builder
    {
        return Booking::withoutGlobalScope(ShopScope::class)
            ->where('customer_id', $customerId);
    }

    public static function find(int $customerId, string $bookingReference): ?Booking
    {
        return self::withRelations(self::base($customerId))
            ->where('booking_reference', $bookingReference)
            ->first();
    }

    public static function withRelations(Builder $query): Builder
    {
        return $query->with([
            'vehicle' => fn ($q) => $q->withoutGlobalScope(ShopScope::class),
            'shop', 'pricing',
            'pickupLocation' => fn ($q) => $q->withoutGlobalScope(ShopScope::class),
            'returnLocation' => fn ($q) => $q->withoutGlobalScope(ShopScope::class),
        ]);
    }
}
