<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Location\StoreLocationRequest;
use App\Http\Requests\Location\UpdateLocationRequest;
use App\Models\Location;
use App\Repositories\LocationRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The active shop's branches / pickup points — see App\Repositories\LocationRepo and App\Models\Location. */
class LocationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private LocationRepo $repo)
    {
        $this->middleware('can:vendor-settings-locations-view')->only(['index', 'show']);
        $this->middleware('can:vendor-settings-locations-create')->only('store');
        $this->middleware('can:vendor-settings-locations-edit')->only('update');
        $this->middleware('can:vendor-settings-locations-delete')->only('destroy');
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as ExpenseCategoryController::index(). */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record' => $this->repo->getData($request),
            'message' => 'Locations retrieved successfully',
            'status' => true,
        ]);
    }

    public function store(StoreLocationRequest $request): JsonResponse
    {
        $location = $this->repo->store($request);

        AuditService::create('Location', $location->id, $location->name);

        return $this->response('Location created', $location, 201);
    }

    public function show(Location $location): JsonResponse
    {
        return $this->response('Location retrieved', $location);
    }

    public function update(UpdateLocationRequest $request, Location $location): JsonResponse
    {
        $old = $location->only($location->getFillable());
        $location = $this->repo->update($location, $request);

        AuditService::edit('Location', $location->id, $location->name, $old, $location->only($location->getFillable()));

        return $this->response('Location updated', $location);
    }

    public function destroy(Location $location): JsonResponse
    {
        try {
            $name = $location->name;
            $this->repo->destroy($location);

            AuditService::delete('Location', $location->id, $name);

            return $this->response('Location deleted');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }
}
