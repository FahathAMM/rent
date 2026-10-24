<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;

/** "Browse by Location" — cities with at least one publicly visible vehicle. */
class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        $cities = PublicVehicleQuery::citiesWithCounts()
            ->map(fn ($row) => ['city' => $row->city, 'vehicle_count' => (int) $row->vehicle_count])
            ->values();

        return response()->json(['data' => $cities]);
    }
}
