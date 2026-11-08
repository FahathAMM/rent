<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\VehicleCategoryResource;
use App\Models\VehicleCategory;
use App\Repositories\PublicVehicleRepo;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        // Same visibility rules as rental search, so a tile's count matches what it opens.
        $visibleCounts = app(PublicVehicleRepo::class)->base()
            ->selectRaw('category_id, count(*) as aggregate')
            ->groupBy('category_id')
            ->pluck('aggregate', 'category_id');

        $categories = VehicleCategory::whereNull('parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->each(fn (VehicleCategory $category) => $category->vehicles_count = (int) ($visibleCounts[$category->id] ?? 0));

        return response()->json(['data' => VehicleCategoryResource::collection($categories)]);
    }
}
