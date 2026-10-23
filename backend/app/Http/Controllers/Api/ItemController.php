<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Item\StoreItemRequest;
use App\Http\Requests\Item\UpdateItemRequest;
use App\Models\Item;
use App\Repositories\ItemRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ItemRepo $repo)
    {
        $this->middleware('can:product-item-view')->only(['index', 'show']);
        $this->middleware('can:product-item-create')->only('store');
        $this->middleware('can:product-item-edit')->only('update');
        $this->middleware('can:product-item-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Products retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreItemRequest $request): JsonResponse
    {
        $item = $this->repo->store($request);

        AuditService::create('Item', $item->id, $item->name);

        return $this->response('Product created successfully', $item, 201);
    }

    public function show(Item $item): JsonResponse
    {
        return $this->response('Product retrieved successfully', $item->load(['unit', 'todayPrice']));
    }

    public function update(UpdateItemRequest $request, Item $item): JsonResponse
    {
        $old = $item->only($item->getFillable());

        $item = $this->repo->update($item, $request);

        AuditService::edit('Item', $item->id, $item->name, $old, $item->only($item->getFillable()));

        return $this->response('Product updated successfully', $item);
    }

    public function destroy(Item $item): JsonResponse
    {
        try {
            $name = $item->name;
            $this->repo->destroy($item);

            AuditService::delete('Item', $item->id, $name);

            return $this->response('Product deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }
}
