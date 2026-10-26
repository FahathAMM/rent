<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\SaveVehicleVariantRequest;
use App\Models\VehicleVariant;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Variants (trims) under a model. index() requires ?model_id=. */
class VehicleVariantController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $request->validate(['model_id' => ['required', 'integer']]);

        $variants = VehicleVariant::withCount('vehicles')
            ->where('model_id', $request->integer('model_id'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->response('Variants retrieved', $variants);
    }

    public function store(SaveVehicleVariantRequest $request): JsonResponse
    {
        $variant = VehicleVariant::create($request->validated());

        AuditService::create('VehicleVariant', $variant->id, $variant->name);

        return $this->response('Variant created', $variant, 201);
    }

    public function update(SaveVehicleVariantRequest $request, VehicleVariant $variant): JsonResponse
    {
        $variant->update($request->validated());

        AuditService::edit('VehicleVariant', $variant->id, $variant->name);

        return $this->response('Variant updated', $variant->fresh());
    }

    /** Vehicles using it just lose the link (variant_id is nullOnDelete; the text copy stays). */
    public function destroy(VehicleVariant $variant): JsonResponse
    {
        $variant->delete();
        AuditService::delete('VehicleVariant', $variant->id, $variant->name);

        return $this->response('Variant deleted');
    }
}
