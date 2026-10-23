<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ReviewResource;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Review;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unauthenticated, cacheable reads only - see routes/public.php. Every
 * query here goes through PublicVehicleQuery, the sole sanctioned
 * ShopScope bypass for public consumption.
 */
class VehicleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'q', 'category_id', 'city', 'transmission', 'fuel_type',
            'seats_min', 'delivery', 'price_min', 'price_max', 'sort',
        ]);

        $vehicles = PublicVehicleQuery::search($filters)
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

    public function show(string $slug): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        $vehicle->increment('view_count');

        return response()->json(['data' => new VehicleResource($vehicle)]);
    }

    public function reviews(string $slug): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        $reviews = Review::where('vehicle_id', $vehicle->id)
            ->where('status', Review::STATUS_PUBLISHED)
            ->with('user:id,name')
            ->latest()
            ->paginate(10);

        return response()->json(['data' => ReviewResource::collection($reviews)]);
    }
}
