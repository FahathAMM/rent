<?php

namespace App\Repositories;

use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Scopes\ShopScope;
use App\Models\VehicleSaleDetail;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Every public (anonymous-visitor) read of rental shops — the Shops directory,
 * a shop's profile, and its fleet stats. With PublicVehicleRepo this is a
 * sanctioned ShopScope bypass for public reads (see
 * tests/Feature/PublicScopeBoundaryTest.php). The "verified" indicator comes
 * from verification_status, never from a flag the frontend could spoof.
 */
class PublicShopRepo extends BaseRepository
{
    /** Directory filters the public API accepts. */
    public const FILTERS = ['q', 'city', 'district', 'verified_only', 'category_id', 'delivery', 'rating_min', 'sort'];

    protected $model;

    public function __construct(RentalShop $model)
    {
        $this->model = $model;
    }

    /** Shops a visitor may see: active and published. */
    public function base(): Builder
    {
        return RentalShop::withoutGlobalScope(ShopScope::class)
            ->where('status', 'active')
            ->where('is_published', true);
    }

    public function findBySlug(string $slug): ?RentalShop
    {
        return $this->base()->where('slug', $slug)->first();
    }

    public function findBySlugOrFail(string $slug): RentalShop
    {
        $shop = $this->findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

        return $shop;
    }

    /**
     * @param array{
     *   q?: string, city?: string, district?: string, verified_only?: bool,
     *   category_id?: int, delivery?: bool, rating_min?: float, sort?: string,
     * } $filters
     */
    public function searchQuery(array $filters): Builder
    {
        // Shops sponsoring right now (live = approved, started, not ended).
        $sponsoredShopIds = Promotion::live()->where('type', Promotion::TYPE_SPONSORED)->pluck('shop_id');

        $query = $this->base();

        // The customer's filters.
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
            $query->whereExists($this->listedVehicles()->where('vehicles.category_id', $filters['category_id']));
        }
        if (!empty($filters['delivery'])) {
            $query->whereExists($this->visibleVehicles()->whereHas('pricing', fn (Builder $q) => $q->where('delivery_available', true)));
        }

        // Sponsored shops UNION ALL the others — is_sponsored is 1 / 0 (it also drives the badge).
        $sponsored = (clone $query)->whereIn('rental_shops.id', $sponsoredShopIds)->select('rental_shops.*')->selectRaw('1 as is_sponsored');
        $others = (clone $query)->whereNotIn('rental_shops.id', $sponsoredShopIds)->select('rental_shops.*')->selectRaw('0 as is_sponsored');

        $results = RentalShop::withoutGlobalScope(ShopScope::class)
            ->fromSub($sponsored->unionAll($others), 'rental_shops')
            ->select('rental_shops.*')
            ->orderByDesc('rental_shops.is_sponsored'); // sponsored first…

        // …then the customer's sort.
        return match ($filters['sort'] ?? 'rating') {
            'reviews' => $results->orderByDesc('rental_shops.rating_count')->orderByDesc('rental_shops.rating_avg'),
            'bookings' => $results->orderByDesc('rental_shops.completed_bookings_count')->orderByDesc('rental_shops.rating_avg'),
            'fleet' => $results->orderByDesc($this->listedVehicles()->selectRaw('count(*)'))->orderByDesc('rental_shops.rating_avg'),
            'newest' => $results->orderByDesc('rental_shops.created_at'),
            'name' => $results->orderBy('rental_shops.name'),
            default => $results->orderByDesc('rental_shops.rating_avg')->orderByDesc('rental_shops.rating_count'),
        };
    }

    public function searchPaginated(array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->searchQuery($filters)->paginate(min(max($perPage, 1), 48));
    }

    /**
     * Per-shop fleet stats over publicly visible vehicles: how many, the
     * cheapest daily rate, and which categories they cover - for the
     * directory cards - plus how many cars it has for sale. One grouped
     * query per stat, not one per shop.
     *
     * @return Collection<int, array{vehicles_count: int, sale_vehicles_count: int, starting_daily_rate: ?float, categories: array<int, string>}>
     */
    public function fleetStats(array $shopIds): Collection
    {
        if (!$shopIds) {
            return collect();
        }
        $vehicles = app(PublicVehicleRepo::class);

        $counts = $vehicles->base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->selectRaw('vehicles.shop_id, count(*) as aggregate')
            ->groupBy('vehicles.shop_id')
            ->pluck('aggregate', 'shop_id');

        $saleCounts = app(PublicSaleRepo::class)->base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->selectRaw('vehicles.shop_id, count(*) as aggregate')
            ->groupBy('vehicles.shop_id')
            ->pluck('aggregate', 'shop_id');

        $minRates = $vehicles->base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')
            ->selectRaw('vehicles.shop_id, min(vehicle_pricing.daily_rate) as aggregate')
            ->groupBy('vehicles.shop_id')
            ->pluck('aggregate', 'shop_id');

        $categories = $vehicles->base()
            ->whereIn('vehicles.shop_id', $shopIds)
            ->join('vehicle_categories', 'vehicle_categories.id', '=', 'vehicles.category_id')
            ->select('vehicles.shop_id', 'vehicle_categories.name', 'vehicle_categories.translations')
            ->distinct()
            ->get()
            ->groupBy('shop_id')
            // In the visitor's language, matching the public category list.
            ->map(fn (Collection $rows) => $rows
                ->map(fn ($row) => \App\Models\VehicleCategory::translateRaw($row->translations, 'name', $row->name))
                ->unique()->sort()->values()->all());

        return collect($shopIds)->mapWithKeys(fn (int $id) => [$id => [
            'vehicles_count' => (int) ($counts[$id] ?? 0),
            'sale_vehicles_count' => (int) ($saleCounts[$id] ?? 0),
            'starting_daily_rate' => isset($minRates[$id]) ? (float) $minRates[$id] : null,
            'categories' => $categories[$id] ?? [],
        ]]);
    }

    /** A shop's rentals and available cars for sale, for filters and sorts about its whole stock. */
    private function listedVehicles(): Builder
    {
        return app(PublicVehicleRepo::class)->visible()
            ->whereColumn('vehicles.shop_id', 'rental_shops.id')
            ->where(fn (Builder $q) => $q->forRent()->orWhere(fn (Builder $s) => $s->forSale()
                ->whereHas('saleDetail', fn (Builder $d) => $d->where('sale_status', VehicleSaleDetail::STATUS_AVAILABLE))));
    }

    /** Publicly visible vehicles of the shop in the outer query (for whereExists / counts). */
    private function visibleVehicles(): Builder
    {
        return app(PublicVehicleRepo::class)->base()->whereColumn('vehicles.shop_id', 'rental_shops.id');
    }
}
