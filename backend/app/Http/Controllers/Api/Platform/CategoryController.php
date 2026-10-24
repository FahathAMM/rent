<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreCategoryRequest;
use App\Http\Requests\Platform\UpdateCategoryRequest;
use App\Models\VehicleCategory;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        $categories = VehicleCategory::withCount('vehicles')
            ->orderBy('sort_order')
            ->get();

        return $this->response('Categories retrieved', $categories);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = VehicleCategory::create($request->validated());

        AuditService::create('VehicleCategory', $category->id, $category->name);

        return $this->response('Category created', $category, 201);
    }

    public function show(VehicleCategory $category): JsonResponse
    {
        $category->loadCount('vehicles');

        return $this->response('Category retrieved', $category);
    }

    public function update(UpdateCategoryRequest $request, VehicleCategory $category): JsonResponse
    {
        $category->update($request->validated());

        AuditService::edit('VehicleCategory', $category->id, $category->name);

        return $this->response('Category updated', $category->fresh());
    }

    public function destroy(VehicleCategory $category): JsonResponse
    {
        if ($category->vehicles()->exists()) {
            throw ValidationException::withMessages(['category' => ['This category still has vehicles assigned — reassign them first.']]);
        }

        $category->delete();
        AuditService::delete('VehicleCategory', $category->id, $category->name);

        return $this->response('Category deleted');
    }
}
