<?php

namespace App\Queries;

use App\Models\RentalShop;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * See PublicVehicleQuery for why this bypass is confined here. Verified
 * owner indicator is derived from verification_status, never from a
 * boolean the frontend could spoof.
 */
class PublicShopQuery
{
    public static function base(): Builder
    {
        return RentalShop::withoutGlobalScope(ShopScope::class)
            ->where('status', 'active')
            ->where('is_published', true);
    }

    public static function findBySlug(string $slug): ?RentalShop
    {
        return self::base()->where('slug', $slug)->first();
    }

    /**
     * @param array{
     *   q?: string, city?: string, district?: string, verified_only?: bool,
     *   category_id?: int, delivery?: bool, rating_min?: float, sort?: string,
     * } $filters
     */
    public static function search(array $filters): Builder
    {
        $query = self::base();

        if (!empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$term}%")
                ->orWhere('tagline', 'like', "%{$term}%")
                ->orWhere('city', 'like', "%{$term}%"));
        }

        if (!empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        if (!empty($filters['district'])) {
            $query->where('district', $filters['district']);
        }

        if (!empty($filters['verified_only'])) {
            $query->where('verification_status', RentalShop::VERIFICATION_VERIFIED);
        }

        if (!empty($filters['rating_min'])) {
            $query->where('rating_avg', '>=', (float) $filters['rating_min']);
        }

        // Vehicle-based filters only count publicly visible vehicles, so a
        // shop can't match "SUVs" on the strength of a draft listing.
        if (!empty($filters['category_id'])) {
            $query->whereExists(self::visibleVehicles()->where('vehicles.category_id', $filters['category_id']));
        }

        if (!empty($filters['delivery'])) {
            $query->whereExists(self::visibleVehicles()->whereHas('pricing', fn (Builder $q) => $q->where('delivery_available', true)));
        }

        return match ($filters['sort'] ?? 'rating') {
            'reviews' => $query->orderByDesc('rating_count')->orderByDesc('rating_avg'),
            'bookings' => $query->orderByDesc('completed_bookings_count')->orderByDesc('rating_avg'),
            'fleet' => $query->orderByDesc(self::visibleVehicles()->selectRaw('count(*)'))->orderByDesc('rating_avg'),
            'newest' => $query->orderByDesc('created_at'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('rating_avg')->orderByDesc('rating_count'),
        };
    }

    /**
     * Per-shop fleet stats over publicly visible vehicles: how many, the
     * cheapest daily rate, and which categories they cover - for the
     * directory cards. One grouped query per stat, not one per shop.
     *
     * @return Collection<int, array{vehicles_count: int, starting_daily_rate: ?float, categories: array<int, string>}>
     */
    public static function fleetStats(array $shopIds): Collection
    {
        if (!$shopIds) {
            return collect();
        }

        $counts = PublicVehicleQuery::base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->selectRaw('vehicles.shop_id, count(*) as aggregate')
            ->groupBy('vehicles.shop_id')
            ->pluck('aggregate', 'shop_id');

        $minRates = PublicVehicleQuery::base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')
            ->selectRaw('vehicles.shop_id, min(vehicle_pricing.daily_rate) as aggregate')
            ->groupBy('vehicles.shop_id')
            ->pluck('aggregate', 'shop_id');

        $categories = PublicVehicleQuery::base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->join('vehicle_categories', 'vehicle_categories.id', '=', 'vehicles.category_id')
            ->select('vehicles.shop_id', 'vehicle_categories.name')
            ->distinct()
            ->get()
            ->groupBy('shop_id')
            ->map(fn (Collection $rows) => $rows->pluck('name')->sort()->values()->all());

        return collect($shopIds)->mapWithKeys(fn (int $id) => [$id => [
            'vehicles_count' => (int) ($counts[$id] ?? 0),
            'starting_daily_rate' => isset($minRates[$id]) ? (float) $minRates[$id] : null,
            'categories' => $categories[$id] ?? [],
        ]]);
    }

    private static function visibleVehicles(): Builder
    {
        return PublicVehicleQuery::base()->whereColumn('vehicles.shop_id', 'rental_shops.id');
    }
}
