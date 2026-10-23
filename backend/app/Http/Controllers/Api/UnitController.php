<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Unit\StoreUnitRequest;
use App\Http\Requests\Unit\UpdateUnitRequest;
use App\Models\Unit;
use App\Repositories\UnitRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private UnitRepo $repo)
    {
        $this->middleware('can:product-unit-view')->only(['index', 'show']);
        $this->middleware('can:product-unit-create')->only('store');
        $this->middleware('can:product-unit-edit')->only('update');
        $this->middleware('can:product-unit-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Units retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreUnitRequest $request): JsonResponse
    {
        $unit = $this->repo->store($request);

        AuditService::create('Unit', $unit->id, $unit->name);

        return $this->response('Unit created successfully', $unit, 201);
    }

    public function show(Unit $unit): JsonResponse
    {
        return $this->response('Unit retrieved successfully', $unit);
    }

    public function update(UpdateUnitRequest $request, Unit $unit): JsonResponse
    {
        $old = $unit->only($unit->getFillable());

        $unit = $this->repo->update($unit, $request);

        AuditService::edit('Unit', $unit->id, $unit->name, $old, $unit->only($unit->getFillable()));

        return $this->response('Unit updated successfully', $unit);
    }

    public function destroy(Unit $unit): JsonResponse
    {
        try {
            $name = $unit->name;
            $this->repo->destroy($unit);

            AuditService::delete('Unit', $unit->id, $name);

            return $this->response('Unit deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }
}
