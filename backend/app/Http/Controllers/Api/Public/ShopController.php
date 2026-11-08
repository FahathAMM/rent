<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ReviewResource;
use App\Http\Resources\Public\SaleVehicleResource;
use App\Http\Resources\Public\ShopResource;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Review;
use App\Repositories\PublicSaleRepo;
use App\Repositories\PublicShopRepo;
use App\Repositories\PublicVehicleRepo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function __construct(private PublicShopRepo $shops) {}

    public function index(Request $request): JsonResponse
    {
        $shops = $this->shops->searchPaginated($request->only(PublicShopRepo::FILTERS), $request->integer('per_page', 12));

        $stats = $this->shops->fleetStats($shops->pluck('id')->all());
        $shops->getCollection()->each(fn ($shop) => $shop->fleet_stats = $stats[$shop->id] ?? null);

        return response()->json([
            'data' => ShopResource::collection($shops),
            'meta' => [
                'current_page' => $shops->currentPage(),
                'last_page' => $shops->lastPage(),
                'total' => $shops->total(),
                'per_page' => $shops->perPage(),
            ],
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $shop = $this->shops->findBySlugOrFail($slug);
        $shop->fleet_stats = $this->shops->fleetStats([$shop->id])[$shop->id];

        return response()->json(['data' => new ShopResource($shop)]);
    }

    public function vehicles(string $slug, Request $request): JsonResponse
    {
        $shop = $this->shops->findBySlugOrFail($slug);

        $vehicles = app(PublicVehicleRepo::class)->searchQuery($request->only(['sort', 'category_id', 'q']))
            ->where('vehicles.shop_id', $shop->id)
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json([
            'data' => VehicleResource::collection($vehicles),
            'meta' => [
                'current_page' => $vehicles->currentPage(),
                'last_page' => $vehicles->lastPage(),
                'total' => $vehicles->total(),
                'per_page' => $vehicles->perPage(),
            ],
        ]);
    }

    /** The shop's cars for sale. Rentals stay in vehicles() above. */
    public function saleVehicles(string $slug, Request $request): JsonResponse
    {
        $shop = $this->shops->findBySlugOrFail($slug);

        $vehicles = app(PublicSaleRepo::class)->searchQuery($request->only(['sort', 'category_id', 'q']))
            ->where('vehicles.shop_id', $shop->id)
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json([
            'data' => SaleVehicleResource::collection($vehicles),
            'meta' => [
                'current_page' => $vehicles->currentPage(),
                'last_page' => $vehicles->lastPage(),
                'total' => $vehicles->total(),
                'per_page' => $vehicles->perPage(),
            ],
        ]);
    }

    /** Published reviews across all of the shop's vehicles, plus a 1-5 star distribution for the summary bar chart. */
    public function reviews(string $slug, Request $request): JsonResponse
    {
        $shop = $this->shops->findBySlugOrFail($slug);

        $published = fn () => Review::where('shop_id', $shop->id)->where('status', Review::STATUS_PUBLISHED);

        $reviews = $published()
            ->with(['user:id,name', 'vehicle:id,title,slug'])
            ->latest()
            ->paginate(min((int) $request->get('per_page', 6), 24));

        $distribution = $published()
            ->selectRaw('rating, count(*) as aggregate')
            ->groupBy('rating')
            ->pluck('aggregate', 'rating');

        return response()->json([
            'data' => ReviewResource::collection($reviews),
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'total' => $reviews->total(),
                'distribution' => collect(range(5, 1))->mapWithKeys(fn ($r) => [$r => (int) ($distribution[$r] ?? 0)]),
            ],
        ]);
    }
}
