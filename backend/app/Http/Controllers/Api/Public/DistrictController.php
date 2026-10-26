<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\District;
use Illuminate\Http\JsonResponse;

/** Sri Lanka districts + cities, for cascading District -> City dropdowns on address/onboarding forms. */
class DistrictController extends Controller
{
    public function index(): JsonResponse
    {
        $districts = District::with('cities:id,district_id,name')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (District $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'cities' => $d->cities->sortBy('name')->values()->map(fn ($c) => ['id' => $c->id, 'name' => $c->name]),
            ]);

        return response()->json(['data' => $districts]);
    }
}
