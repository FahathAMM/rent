<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Repositories\PublicVehicleRepo;
use Illuminate\Http\JsonResponse;

/** "Browse by Location" — cities with at least one publicly visible vehicle. */
class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        $cities = app(PublicVehicleRepo::class)->citiesWithCounts()
            ->map(fn ($row) => [
                'city' => $row->city,
                'district' => $row->district,
                'vehicle_count' => (int) $row->vehicle_count,
            ])
            ->values();

        return response()->json(['data' => $cities]);
    }
}
