<?php

namespace App\Repositories;

use App\Http\Requests\Unit\StoreUnitRequest;
use App\Http\Requests\Unit\UpdateUnitRequest;
use App\Models\Unit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class UnitRepo extends BaseRepository
{
    protected $model;

    public function __construct(Unit $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'name';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreUnitRequest $request): Unit
    {
        return $this->model->create($request->validated());
    }

    public function update(Unit $unit, UpdateUnitRequest $request): Unit
    {
        $unit->update($request->validated());

        return $unit->fresh();
    }

    public function destroy(Unit $unit): void
    {
        if ($unit->items()->exists()) {
            throw new \RuntimeException('Cannot delete a unit that is still used by products.');
        }

        $unit->delete();
    }
}
