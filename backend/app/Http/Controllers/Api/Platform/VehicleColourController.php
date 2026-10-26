<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\SaveVehicleColourRequest;
use App\Models\VehicleColour;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

class VehicleColourController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        $colours = VehicleColour::withCount('vehicles')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->response('Colours retrieved', $colours);
    }

    public function store(SaveVehicleColourRequest $request): JsonResponse
    {
        $colour = VehicleColour::create($request->validated());

        AuditService::create('VehicleColour', $colour->id, $colour->name);

        return $this->response('Colour created', $colour, 201);
    }

    public function update(SaveVehicleColourRequest $request, VehicleColour $colour): JsonResponse
    {
        $colour->update($request->validated());

        AuditService::edit('VehicleColour', $colour->id, $colour->name);

        return $this->response('Colour updated', $colour->fresh());
    }

    /** Vehicles using it just lose the link (colour_id is nullOnDelete; the text copy stays). */
    public function destroy(VehicleColour $colour): JsonResponse
    {
        $colour->delete();
        AuditService::delete('VehicleColour', $colour->id, $colour->name);

        return $this->response('Colour deleted');
    }
}
