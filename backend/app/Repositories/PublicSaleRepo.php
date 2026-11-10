<?php

namespace App\Repositories;

use App\Models\Promotion;
use App\Models\Scopes\ShopScope;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleModel;
use App\Models\VehicleSaleDetail;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Every public read of cars for sale: the Buy page. The same visibility rules
 * as rentals (PublicVehicleRepo::visible), plus the car must still be
 * available. Only Http\Resources\Public\SaleVehicleResource shapes the
 * response. A sanctioned ShopScope bypass; see
 * tests/Feature/PublicScopeBoundaryTest.php.
 */
class PublicSaleRepo
{
    /** Search filters the public API accepts. */
    public const FILTERS = [
        'q', 'category_id', 'brand_id', 'model_id', 'colour_id', 'district', 'city', 'transmission', 'fuel_type',
        'seats_min', 'condition', 'price_min', 'price_max', 'year_min', 'year_max', 'mileage_max', 'sort',
    ];

    public function __construct(private PublicVehicleRepo $vehicles) {}

    public function base(): Builder
    {
        return $this->vehicles->visible()->forSale()
            ->whereHas('saleDetail', fn (Builder $q) => $q->where('sale_status', VehicleSaleDetail::STATUS_AVAILABLE));
    }

    public function searchQuery(array $filters): Builder
    {
        $featuredVehicleIds = Promotion::live()->where('type', Promotion::TYPE_FEATURED)->pluck('vehicle_id');

        $query = $this->base();

        if (!empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(fn (Builder $q) => $q
                ->where('title', 'like', "%{$term}%")
                ->orWhere('make', 'like', "%{$term}%")
                ->orWhere('model', 'like', "%{$term}%"));
        }
        foreach (['category_id', 'brand_id', 'model_id', 'colour_id', 'transmission', 'fuel_type'] as $column) {
            if (!empty($filters[$column])) {
                $query->where($column, $filters[$column]);
            }
        }
        foreach (['district', 'city'] as $column) {
            if (!empty($filters[$column])) {
                $query->whereHas('shop', fn (Builder $q) => $q->where($column, $filters[$column]));
            }
        }
        if (!empty($filters['seats_min'])) {
            $query->where('seating_capacity', '>=', (int) $filters['seats_min']);
        }
        if (!empty($filters['year_min'])) {
            $query->where('year', '>=', (int) $filters['year_min']);
        }
        if (!empty($filters['year_max'])) {
            $query->where('year', '<=', (int) $filters['year_max']);
        }
        if (!empty($filters['condition'])) {
            $query->whereHas('saleDetail', fn (Builder $q) => $q->where('condition', $filters['condition']));
        }
        if (isset($filters['price_min']) && $filters['price_min'] !== '') {
            $query->whereHas('saleDetail', fn (Builder $q) => $q->where('price', '>=', $filters['price_min']));
        }
        if (isset($filters['price_max']) && $filters['price_max'] !== '') {
            $query->whereHas('saleDetail', fn (Builder $q) => $q->where('price', '<=', $filters['price_max']));
        }
        if (isset($filters['mileage_max']) && $filters['mileage_max'] !== '') {
            $query->whereHas('saleDetail', fn (Builder $q) => $q->where('mileage_km', '<=', $filters['mileage_max']));
        }

        // Featured cars UNION ALL the others, as in PublicVehicleRepo::searchQuery.
        $featured = (clone $query)->whereIn('vehicles.id', $featuredVehicleIds)->select('vehicles.*')->selectRaw('1 as is_featured');
        $others = (clone $query)->whereNotIn('vehicles.id', $featuredVehicleIds)->select('vehicles.*')->selectRaw('0 as is_featured');

        $results = Vehicle::withoutGlobalScope(ShopScope::class)
            ->fromSub($featured->unionAll($others), 'vehicles')
            ->select('vehicles.*')
            ->join('vehicle_sale_details', 'vehicle_sale_details.vehicle_id', '=', 'vehicles.id')
            ->with(['category', 'brand', 'shop', 'saleDetail', 'images' => fn ($q) => $q->orderBy('sort_order')->with('attachment')])
            ->orderByDesc('vehicles.is_featured');

        return match ($filters['sort'] ?? 'newest') {
            'price_asc' => $results->orderBy('vehicle_sale_details.price'),
            'price_desc' => $results->orderByDesc('vehicle_sale_details.price'),
            'mileage_asc' => $results->orderBy('vehicle_sale_details.mileage_km'),
            'year_desc' => $results->orderByDesc('vehicles.year'),
            default => $results->orderByDesc('vehicles.published_at')->orderByDesc('vehicles.id'),
        };
    }

    public function searchPaginated(array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->searchQuery($filters)->paginate(min(max($perPage, 1), 48));
    }

    /**
     * The brands, models (of `$brandId`) and places that have a car for sale,
     * for the Buy page's filters. Browse's lists count rentals, so they can't
     * be reused: an option with nothing behind it helps nobody.
     */
    public function filterOptions(?int $brandId): array
    {
        $brandIds = $this->base()->whereNotNull('brand_id')->distinct()->pluck('brand_id');
        $modelIds = $brandId ? $this->base()->where('brand_id', $brandId)->whereNotNull('model_id')->distinct()->pluck('model_id') : collect();

        return [
            'brands' => VehicleBrand::whereIn('id', $brandIds)->orderBy('name')->get(['id', 'name']),
            'models' => VehicleModel::whereIn('id', $modelIds)->orderBy('name')->get(['id', 'name']),
            'locations' => $this->base()
                ->join('rental_shops', 'rental_shops.id', '=', 'vehicles.shop_id')
                ->select('rental_shops.city', 'rental_shops.district')
                ->selectRaw('count(*) as vehicle_count')
                ->groupBy('rental_shops.city', 'rental_shops.district')
                ->get()
                ->map(fn ($row) => ['city' => $row->city, 'district' => $row->district, 'vehicle_count' => (int) $row->vehicle_count]),
        ];
    }

    public function findBySlug(string $slug): ?Vehicle
    {
        return $this->base()
            ->with(['category', 'brand', 'vehicleColour', 'shop', 'saleDetail', 'images' => fn ($q) => $q->orderBy('sort_order')->with('attachment')])
            ->where('slug', $slug)
            ->first();
    }

    public function findBySlugOrFail(string $slug): Vehicle
    {
        $vehicle = $this->findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        return $vehicle;
    }

    public function recordView(Vehicle $vehicle): void
    {
        $this->vehicles->recordView($vehicle);
    }
}
