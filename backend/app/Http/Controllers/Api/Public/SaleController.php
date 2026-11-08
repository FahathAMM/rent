<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\SaleVehicleResource;
use App\Repositories\PublicSaleRepo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The Buy page — unauthenticated reads, through PublicSaleRepo and SaleVehicleResource's allow-list. */
class SaleController extends Controller
{
    public function __construct(private PublicSaleRepo $repo) {}

    public function index(Request $request): JsonResponse
    {
        $vehicles = $this->repo->searchPaginated($request->only(PublicSaleRepo::FILTERS), $request->integer('per_page', 12));

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

    /** What the Buy page's filters can offer. ?brand_id= adds that brand's models. */
    public function filters(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->repo->filterOptions($request->integer('brand_id') ?: null)]);
    }

    public function show(string $slug): JsonResponse
    {
        $vehicle = $this->repo->findBySlugOrFail($slug);
        $this->repo->recordView($vehicle);

        return response()->json(['data' => new SaleVehicleResource($vehicle)]);
    }
}
