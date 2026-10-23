<?php

namespace App\Repositories;

use App\Http\Requests\Item\StoreItemRequest;
use App\Http\Requests\Item\UpdateItemRequest;
use App\Models\Item;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ItemRepo extends BaseRepository
{
    protected $model;

    public function __construct(Item $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'category', 'selling_price', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'name';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->with(['unit', 'todayPrice'])
            ->when($request->search, fn ($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%"))
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreItemRequest $request): Item
    {
        return $this->model->create($request->validated())->load(['unit', 'todayPrice']);
    }

    public function update(Item $item, UpdateItemRequest $request): Item
    {
        $item->update($request->validated());

        return $item->fresh(['unit', 'todayPrice']);
    }

    public function destroy(Item $item): void
    {
        if ($item->purchaseItems()->exists() || $item->saleItems()->exists()) {
            throw new \RuntimeException('Cannot delete an item that has purchase or sale history.');
        }

        $item->delete();
    }
}
