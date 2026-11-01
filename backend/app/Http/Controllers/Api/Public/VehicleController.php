<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ReviewResource;
use App\Http\Resources\Public\VehicleResource;
use App\Repositories\PublicVehicleRepo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unauthenticated, cacheable reads only - see routes/public.php. Data access
 * lives in PublicVehicleRepo, the sanctioned ShopScope bypass for public reads.
 */
class VehicleController extends Controller
{
    public function __construct(private PublicVehicleRepo $repo) {}

    public function index(Request $request): JsonResponse
    {
        $vehicles = $this->repo->searchPaginated($request->only(PublicVehicleRepo::FILTERS), $request->integer('per_page', 12));

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
        $vehicle = $this->repo->findBySlugOrFail($slug);
        $this->repo->recordView($vehicle);

        return response()->json(['data' => new VehicleResource($vehicle)]);
    }

    public function reviews(string $slug): JsonResponse
    {
        $reviews = $this->repo->publishedReviews($this->repo->findBySlugOrFail($slug));

        return response()->json(['data' => ReviewResource::collection($reviews)]);
    }

    /** Booked / blocked days and the earliest pickup — feeds the booking date picker. See PublicVehicleRepo::availability(). */
    public function availability(string $slug): JsonResponse
    {
        return response()->json(['data' => $this->repo->availability($this->repo->findBySlugOrFail($slug))]);
    }
}
