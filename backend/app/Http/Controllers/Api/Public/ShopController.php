<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ShopResource;
use App\Http\Resources\Public\VehicleResource;
use App\Queries\PublicShopQuery;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shops = PublicShopQuery::search($request->only(['q', 'city', 'verified_only']))
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json(['data' => ShopResource::collection($shops)]);
    }

    public function show(string $slug): JsonResponse
    {
        $shop = PublicShopQuery::findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

        return response()->json(['data' => new ShopResource($shop)]);
    }

    public function vehicles(string $slug, Request $request): JsonResponse
    {
        $shop = PublicShopQuery::findBySlug($slug);
        abort_if(!$shop, 404, 'Shop not found.');

        $vehicles = PublicVehicleQuery::search($request->only(['sort']))
            ->where('vehicles.shop_id', $shop->id)
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json(['data' => VehicleResource::collection($vehicles)]);
    }
}
