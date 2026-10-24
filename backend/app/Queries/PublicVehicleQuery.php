<?php

namespace App\Queries;

use App\Models\Scopes\ShopScope;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;

/**
 * The ONLY place `withoutGlobalScope(ShopScope::class)` is used for reads
 * meant for an anonymous visitor - see
 * app-doc/marketplace/01-phase1-architecture.md section 2.2. A guard-rail
 * test asserts this file is the sole occurrence outside App\Queries\Public*
 * (see tests/Feature/PublicScopeBoundaryTest.php).
 *
 * A vehicle is publicly visible only when every one of these holds:
 *   - vehicles.status = published
 *   - vehicles.moderation_status = approved
 *   - its shop is active and is_published
 * Never select '*' here - only Http\Resources\Public\* may shape what
 * actually reaches the response, but this query still avoids loading
 * columns (registration_number, condition_notes, internal notes) that
 * resource should never have the chance to leak.
 */
class PublicVehicleQuery
{
    public static function base(): Builder
    {
        return Vehicle::withoutGlobalScope(ShopScope::class)
            ->where('vehicles.status', Vehicle::STATUS_PUBLISHED)
            ->where('vehicles.moderation_status', Vehicle::MODERATION_APPROVED)
            ->whereHas('shop', fn (Builder $q) => $q
                ->where('status', 'active')
                ->where('is_published', true));
    }

    /**
     * @param array{
     *   q?: string, category_id?: int, district?: string, city?: string,
     *   pickup_at?: string, return_at?: string,
     *   price_min?: float, price_max?: float,
     *   transmission?: string, fuel_type?: string, seats_min?: int,
     *   delivery?: bool, sort?: string,
     * } $filters
     */
    public static function search(array $filters): Builder
    {
        $query = self::base()->with(['category', 'shop', 'pricing', 'images' => fn ($q) => $q->orderBy('sort_order')->with('attachment')]);

        if (!empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('title', 'like', "%{$term}%")
                    ->orWhere('make', 'like', "%{$term}%")
                    ->orWhere('model', 'like', "%{$term}%");
            });
        }

        if (!empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        if (!empty($filters['district'])) {
            $query->whereHas('shop', fn (Builder $q) => $q->where('district', $filters['district']));
        }

        if (!empty($filters['city'])) {
            $query->whereHas('shop', fn (Builder $q) => $q->where('city', $filters['city']));
        }

        if (!empty($filters['transmission'])) {
            $query->where('transmission', $filters['transmission']);
        }

        if (!empty($filters['fuel_type'])) {
            $query->where('fuel_type', $filters['fuel_type']);
        }

        if (!empty($filters['seats_min'])) {
            $query->where('seating_capacity', '>=', $filters['seats_min']);
        }

        if (!empty($filters['delivery'])) {
            $query->whereHas('pricing', fn (Builder $q) => $q->where('delivery_available', true));
        }

        if (isset($filters['price_min']) || isset($filters['price_max'])) {
            $query->whereHas('pricing', function (Builder $q) use ($filters) {
                if (isset($filters['price_min'])) {
                    $q->where('daily_rate', '>=', $filters['price_min']);
                }
                if (isset($filters['price_max'])) {
                    $q->where('daily_rate', '<=', $filters['price_max']);
                }
            });
        }

        // NOTE: pickup_at/return_at availability filtering (exclude vehicles
        // with a blocking vehicle_availability row or an active
        // reservation_hold in range) lands in Phase 3 alongside the
        // availability calendar endpoints — this is a structural seam, not
        // a forgotten filter.

        return match ($filters['sort'] ?? 'relevance') {
            'price_asc' => $query->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')
                ->orderBy('vehicle_pricing.daily_rate', 'asc')->select('vehicles.*'),
            'price_desc' => $query->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')
                ->orderBy('vehicle_pricing.daily_rate', 'desc')->select('vehicles.*'),
            'newest' => $query->orderByDesc('published_at'),
            default => $query->orderByDesc('is_featured')->orderByDesc('rating_avg')->orderByDesc('booking_count'),
        };
    }

    /** Cities (with their district) that have at least one publicly visible vehicle, most vehicles first — "Browse by Location". */
    public static function citiesWithCounts(): \Illuminate\Support\Collection
    {
        return self::base()
            ->join('rental_shops', 'rental_shops.id', '=', 'vehicles.shop_id')
            ->select('rental_shops.city', 'rental_shops.district')
            ->selectRaw('count(*) as vehicle_count')
            ->groupBy('rental_shops.city', 'rental_shops.district')
            ->orderByDesc('vehicle_count')
            ->get();
    }

    public static function findBySlug(string $slug): ?Vehicle
    {
        return self::base()
            ->with(['category', 'shop', 'pricing', 'pickupLocations.location', 'images' => fn ($q) => $q->orderBy('sort_order')->with('attachment')])
            ->where('slug', $slug)
            ->first();
    }

    /**
     * Used by booking creation (a customer, not an anonymous visitor, but
     * the same "must actually be publicly bookable" precondition applies)
     * - see BookingService::create(). Deliberately the same base() filter
     * as findBySlug(), not a plain Vehicle::find(), so a customer can
     * never request a booking against a draft/unapproved/unpublished
     * vehicle just by guessing its id.
     */
    public static function findById(int $id): ?Vehicle
    {
        return self::base()->with(['pricing', 'shop.settings'])->find($id);
    }
}
