<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreInquiryRequest;
use App\Queries\PublicVehicleQuery;
use App\Services\AuthUser;
use App\Services\InquiryService;
use Illuminate\Http\JsonResponse;

class InquiryController extends Controller
{
    public function __construct(private InquiryService $service) {}

    public function store(StoreInquiryRequest $request): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($request->validated('vehicle_slug'));
        abort_unless($vehicle, 404, 'Vehicle not found.');

        $this->service->create(
            $vehicle,
            AuthUser::user(),
            $request,
            $request->safe()->except('vehicle_slug'),
        );

        return response()->json(['message' => 'Your message has been sent to the owner'], 201);
    }
}
