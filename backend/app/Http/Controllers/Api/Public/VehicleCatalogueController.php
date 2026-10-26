<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\VehicleColour;
use App\Models\VehicleModel;
use App\Models\VehicleVariant;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The managed vehicle lists under a brand - models, variants and colours.
 * Feeds the vendor vehicle form's cascading dropdowns and the /browse
 * filters. Only active entries; models also carry how many publicly
 * visible vehicles they have (same rules as search, via PublicVehicleQuery).
 */
class VehicleCatalogueController extends Controller
{
    public function models(Request $request): JsonResponse
    {
        $request->validate(['brand_id' => ['required', 'integer']]);

        $visibleCounts = PublicVehicleQuery::base()
            ->where('brand_id', $request->integer('brand_id'))
            ->whereNotNull('model_id')
            ->selectRaw('model_id, count(*) as aggregate')
            ->groupBy('model_id')
            ->pluck('aggregate', 'model_id');

        $models = VehicleModel::where('brand_id', $request->integer('brand_id'))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'brand_id', 'name', 'slug'])
            ->each(fn (VehicleModel $m) => $m->vehicles_count = (int) ($visibleCounts[$m->id] ?? 0));

        return response()->json(['data' => $models]);
    }

    public function variants(Request $request): JsonResponse
    {
        $request->validate(['model_id' => ['required', 'integer']]);

        $variants = VehicleVariant::where('model_id', $request->integer('model_id'))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'model_id', 'name']);

        return response()->json(['data' => $variants]);
    }

    public function colours(): JsonResponse
    {
        $colours = VehicleColour::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'hex']);

        return response()->json(['data' => $colours]);
    }
}
