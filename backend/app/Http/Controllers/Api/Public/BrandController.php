<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\VehicleBrandResource;
use App\Models\VehicleBrand;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;

class BrandController extends Controller
{
    /**
     * Active brands, each with how many publicly visible vehicles it has
     * (the same visibility rules as search, via PublicVehicleQuery) - so
     * the vendor form can list every brand while the home page / browse
     * filter can hide brands nobody is renting out yet.
     */
    public function index(): JsonResponse
    {
        $visibleCounts = PublicVehicleQuery::base()
            ->whereNotNull('brand_id')
            ->selectRaw('brand_id, count(*) as aggregate')
            ->groupBy('brand_id')
            ->pluck('aggregate', 'brand_id');

        $brands = VehicleBrand::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->each(fn (VehicleBrand $brand) => $brand->vehicles_count = (int) ($visibleCounts[$brand->id] ?? 0));

        return response()->json(['data' => VehicleBrandResource::collection($brands)]);
    }
}
