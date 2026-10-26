<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreBrandRequest;
use App\Http\Requests\Platform\UpdateBrandRequest;
use App\Models\VehicleBrand;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Vehicle brands - platform-managed like categories. Logo uploads are
 * multipart, so update() is reached via POST + _method=PUT (same as the
 * platform-details logo upload).
 */
class BrandController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        $brands = VehicleBrand::withCount('vehicles')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->response('Brands retrieved', $brands);
    }

    public function store(StoreBrandRequest $request): JsonResponse
    {
        $data = $request->safe()->except('logo');

        if ($request->hasFile('logo')) {
            $data['logo'] = $request->file('logo')->store('brand-logos', 'public');
        }

        $brand = VehicleBrand::create($data);

        AuditService::create('VehicleBrand', $brand->id, $brand->name);

        return $this->response('Brand created', $brand, 201);
    }

    public function show(VehicleBrand $brand): JsonResponse
    {
        $brand->loadCount('vehicles');

        return $this->response('Brand retrieved', $brand);
    }

    public function update(UpdateBrandRequest $request, VehicleBrand $brand): JsonResponse
    {
        $data = $request->safe()->except(['logo', 'remove_logo']);

        if ($request->hasFile('logo') || $request->boolean('remove_logo')) {
            if ($brand->logo) {
                Storage::disk('public')->delete($brand->logo);
            }
            $data['logo'] = $request->hasFile('logo')
                ? $request->file('logo')->store('brand-logos', 'public')
                : null;
        }

        $brand->update($data);

        AuditService::edit('VehicleBrand', $brand->id, $brand->name);

        return $this->response('Brand updated', $brand->fresh());
    }

    public function destroy(VehicleBrand $brand): JsonResponse
    {
        if ($brand->vehicles()->exists()) {
            throw ValidationException::withMessages(['brand' => ['This brand still has vehicles assigned — deactivate it instead.']]);
        }

        if ($brand->logo) {
            Storage::disk('public')->delete($brand->logo);
        }

        $brand->delete();
        AuditService::delete('VehicleBrand', $brand->id, $brand->name);

        return $this->response('Brand deleted');
    }
}
