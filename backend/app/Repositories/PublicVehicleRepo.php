<?php

namespace App\Repositories;

use App\Models\Promotion;
use App\Models\Review;
use App\Models\Scopes\ShopScope;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Every public (anonymous-visitor) read of vehicles — search, detail, reviews,
 * the booking calendar, catalogue counts — and the bookability check used
 * when a customer requests a booking.
 *
 * This, with App\Repositories\PublicShopRepo and App\Queries\Customer*, is the
 * ONLY place `withoutGlobalScope(ShopScope::class)` is used for reads — see
 * app-doc/marketplace/01-phase1-architecture.md section 2.2 and the guard-rail
 * test tests/Feature/PublicScopeBoundaryTest.php.
 *
 * A vehicle is publicly visible only when every one of these holds:
 *   - vehicles.status = published
 *   - vehicles.moderation_status = approved
 *   - its shop is active and is_published
 * Only Http\Resources\Public\* may shape what reaches the response.
 */
class PublicVehicleRepo extends BaseRepository
{
    /** Search filters the public API accepts. */
    public const FILTERS = [
        'q', 'category_id', 'brand_id', 'model_id', 'colour_id', 'district', 'city', 'transmission', 'fuel_type',
        'seats_min', 'delivery', 'price_min', 'price_max', 'sort',
    ];

    protected $model;

    public function __construct(Vehicle $model)
    {
        $this->model = $model;
    }

    /**
     * Publicly visible rental vehicles — the base every rental read starts
     * from, so search, detail, booking and the shop and brand counts never
     * see a car on sale. The Buy page has its own: PublicSaleRepo.
     */
    public function base(): Builder
    {
        return $this->visible()->forRent();
    }

    /** Publicly visible vehicles of either type. */
    public function visible(): Builder
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
     *   q?: string, category_id?: int, brand_id?: int, model_id?: int, colour_id?: int, district?: string, city?: string,
     *   pickup_at?: string, return_at?: string,
     *   price_min?: float, price_max?: float,
     *   transmission?: string, fuel_type?: string, seats_min?: int,
     *   delivery?: bool, sort?: string,
     * } $filters
     */
    public function searchQuery(array $filters): Builder
    {
        // Vehicles featured right now (live = approved, started, not ended).
        $featuredVehicleIds = Promotion::live()->where('type', Promotion::TYPE_FEATURED)->pluck('vehicle_id');

        $query = $this->base();

        // The customer's filters.
        if (!empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(fn (Builder $q) => $q
                ->where('title', 'like', "%{$term}%")
                ->orWhere('make', 'like', "%{$term}%")
                ->orWhere('model', 'like', "%{$term}%"));
        }
        if (!empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }
        if (!empty($filters['brand_id'])) {
            $query->where('brand_id', $filters['brand_id']);
        }
        if (!empty($filters['model_id'])) {
            $query->where('model_id', $filters['model_id']);
        }
        if (!empty($filters['colour_id'])) {
            $query->where('colour_id', $filters['colour_id']);
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
        if (isset($filters['price_min'])) {
            $query->whereHas('pricing', fn (Builder $q) => $q->where('daily_rate', '>=', $filters['price_min']));
        }
        if (isset($filters['price_max'])) {
            $query->whereHas('pricing', fn (Builder $q) => $q->where('daily_rate', '<=', $filters['price_max']));
        }

        // Featured vehicles UNION ALL the others — is_featured is 1 / 0 (it also drives the badge).
        $featured = (clone $query)
        ->whereIn('vehicles.id', $featuredVehicleIds)->select('vehicles.*')->selectRaw('1 as is_featured');

        $others = (clone $query)
        ->whereNotIn('vehicles.id', $featuredVehicleIds)->select('vehicles.*')->selectRaw('0 as is_featured');

        $results = Vehicle::withoutGlobalScope(ShopScope::class)
            ->fromSub($featured->unionAll($others), 'vehicles')
            ->select('vehicles.*')
            ->with(['category', 'brand', 'shop', 'pricing', 'images' => fn ($q) => $q->orderBy('sort_order')
            ->with('attachment')])
            ->orderByDesc('vehicles.is_featured'); // featured first…

        // …then the customer's sort.
        return match ($filters['sort'] ?? 'relevance') {
            'price_asc' => $results->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')->orderBy('vehicle_pricing.daily_rate'),
            'price_desc' => $results->join('vehicle_pricing', 'vehicle_pricing.vehicle_id', '=', 'vehicles.id')->orderByDesc('vehicle_pricing.daily_rate'),
            'newest' => $results->orderByDesc('vehicles.published_at'),
            default => $results->orderByDesc('vehicles.rating_avg')->orderByDesc('vehicles.booking_count'),
        };
    }

    public function searchPaginated(array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->searchQuery($filters)->paginate(min(max($perPage, 1), 48));
    }

    /** Cities (with their district) that have at least one publicly visible vehicle, most vehicles first — "Browse by Location". */
    public function citiesWithCounts(): Collection
    {
        return $this->base()
            ->join('rental_shops', 'rental_shops.id', '=', 'vehicles.shop_id')
            ->select('rental_shops.city', 'rental_shops.district')
            ->selectRaw('count(*) as vehicle_count')
            ->groupBy('rental_shops.city', 'rental_shops.district')
            ->orderByDesc('vehicle_count')
            ->get();
    }

    public function findBySlug(string $slug): ?Vehicle
    {
        return $this->base()
            ->with(['category', 'brand', 'vehicleColour', 'shop', 'shop.primaryBankDetail', 'pricing', 'pickupLocations.location', 'images' => fn ($q) => $q->orderBy('sort_order')->with('attachment')])
            ->where('slug', $slug)
            ->first();
    }

    /** A publicly visible vehicle by slug, or 404. */
    public function findBySlugOrFail(string $slug): Vehicle
    {
        $vehicle = $this->findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        return $vehicle;
    }

    /**
     * Used by booking creation (a customer, not an anonymous visitor, but
     * the same "must actually be publicly bookable" precondition applies)
     * - see BookingService::create(). Deliberately the same base() filter
     * as findBySlug(), not a plain Vehicle::find(), so a customer can
     * never request a booking against a draft/unapproved/unpublished
     * vehicle just by guessing its id.
     */
    public function findById(int $id): ?Vehicle
    {
        return $this->base()->with(['pricing', 'shop.settings'])->find($id);
    }

    public function recordView(Vehicle $vehicle): void
    {
        $vehicle->increment('view_count');
    }

    public function publishedReviews(Vehicle $vehicle, int $perPage = 10): LengthAwarePaginator
    {
        return Review::where('vehicle_id', $vehicle->id)
            ->where('status', Review::STATUS_PUBLISHED)
            ->with('user:id,name')
            ->latest()
            ->paginate($perPage);
    }

    /**
     * What the booking calendar needs to grey out dates: the days (nights) the
     * vehicle is booked, blocked or in maintenance, plus the earliest pickup
     * date the shop's advance notice allows. Only dates — no booking details.
     * Mirrors BookingService::assertRequestIsValid(): a rental from A to B
     * (10:00 pickup/return) uses the days A … B-1, so B itself may be taken.
     */
    public function availability(Vehicle $vehicle): array
    {
        $today = now()->startOfDay();
        $until = $today->copy()->addYear();

        $unavailable = VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [VehicleAvailability::STATUS_BOOKED, VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$today->toDateString(), $until->toDateString()])
            ->orderBy('date')
            ->pluck('date')
            ->map(fn ($date) => $date->toDateString())
            ->unique()
            ->values();

        // The booking widget sends a fixed 10:00 pickup; the first day whose 10:00 clears the notice period.
        $noticeEnds = now()->addHours((int) ($vehicle->pricing?->advance_notice_hours ?? 0));
        $earliest = $today->copy()->setTime(10, 0);
        while ($earliest->lessThan($noticeEnds)) {
            $earliest->addDay();
        }

        return [
            'unavailable_dates' => $unavailable,
            'earliest_pickup_date' => $earliest->toDateString(),
            'bookable_until' => $until->toDateString(),
            'min_rental_days' => $vehicle->pricing?->min_rental_days,
            'max_rental_days' => $vehicle->pricing?->max_rental_days,
        ];
    }
}
