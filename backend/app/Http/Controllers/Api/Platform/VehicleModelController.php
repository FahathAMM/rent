<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\SaveVehicleModelRequest;
use App\Models\VehicleModel;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Models under a brand. index() takes an optional ?brand_id= filter. */
class VehicleModelController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $models = VehicleModel::with('brand:id,name')
            ->withCount(['vehicles', 'variants'])
            ->when($request->filled('brand_id'), fn ($q) => $q->where('brand_id', $request->integer('brand_id')))
            ->orderBy('brand_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->response('Models retrieved', $models);
    }

    public function store(SaveVehicleModelRequest $request): JsonResponse
    {
        $model = VehicleModel::create($request->validated());

        AuditService::create('VehicleModel', $model->id, $model->name);

        return $this->response('Model created', $model->load('brand:id,name'), 201);
    }

    public function update(SaveVehicleModelRequest $request, VehicleModel $model): JsonResponse
    {
        if ((int) $request->validated('brand_id') !== $model->brand_id && $model->vehicles()->exists()) {
            throw ValidationException::withMessages(['brand_id' => ['Vehicles already use this model — it cannot move to another brand.']]);
        }

        $model->update($request->validated());

        AuditService::edit('VehicleModel', $model->id, $model->name);

        return $this->response('Model updated', $model->fresh('brand:id,name'));
    }

    public function destroy(VehicleModel $model): JsonResponse
    {
        if ($model->vehicles()->exists()) {
            throw ValidationException::withMessages(['model' => ['This model still has vehicles assigned — deactivate it instead.']]);
        }

        $model->delete(); // its variants cascade
        AuditService::delete('VehicleModel', $model->id, $model->name);

        return $this->response('Model deleted');
    }
}
