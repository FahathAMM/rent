<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ReviewResource;
use App\Http\Resources\Public\ShopResource;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Review;
use App\Queries\PublicShopQuery;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'q', 'city', 'district', 'verified_only', 'category_id', 'delivery', 'rating_min', 'sort',
        ]);

        $shops = PublicShopQuery::search($filters)
            ->paginate(min((int) $request->get('per_page', 12), 48));

        $stats = PublicShopQuery::fleetStats($shops->pluck('id')->all());
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
        $shop = PublicShopQuery::findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

        $shop->fleet_stats = PublicShopQuery::fleetStats([$shop->id])[$shop->id];

        return response()->json(['data' => new ShopResource($shop)]);
    }

    public function vehicles(string $slug, Request $request): JsonResponse
    {
        $shop = PublicShopQuery::findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

        $vehicles = PublicVehicleQuery::search($request->only(['sort', 'category_id', 'q']))
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

    /** Published reviews across all of the shop's vehicles, plus a 1-5 star distribution for the summary bar chart. */
    public function reviews(string $slug, Request $request): JsonResponse
    {
        $shop = PublicShopQuery::findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

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
