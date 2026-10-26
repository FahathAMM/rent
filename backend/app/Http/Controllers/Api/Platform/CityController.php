<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreCityRequest;
use App\Models\City;
use App\Models\District;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/** Platform-managed District/City reference data feeding the owner/shop onboarding forms' location dropdowns. */
class CityController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        $districts = District::with('cities:id,district_id,name')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (District $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'cities' => $d->cities->sortBy('name')->values(),
            ]);

        return $this->response('Districts retrieved', $districts);
    }

    public function store(StoreCityRequest $request): JsonResponse
    {
        $city = City::create($request->validated())->load('district:id,name');

        AuditService::create('City', $city->id, "{$city->name} ({$city->district->name})");

        return $this->response('City created', $city, 201);
    }

    public function destroy(City $city): JsonResponse
    {
        $label = "{$city->name} ({$city->district?->name})";
        $city->delete();

        AuditService::delete('City', $city->id, $label);

        return $this->response('City deleted');
    }
}
