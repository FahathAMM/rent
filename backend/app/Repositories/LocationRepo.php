<?php

namespace App\Repositories;

use App\Http\Requests\Location\StoreLocationRequest;
use App\Http\Requests\Location\UpdateLocationRequest;
use App\Models\Location;
use App\Support\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LocationRepo extends BaseRepository
{
    protected $model;

    public function __construct(Location $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'is_active', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'name';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->withCount(['employees', 'assets'])
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreLocationRequest $request): Location
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();
            $data['branch_code'] = NumberGenerator::next(Tenant::id(), 'branch');

            return $this->model->create($data);
        });
    }

    public function update(Location $location, UpdateLocationRequest $request): Location
    {
        $location->update($request->validated());

        return $location->fresh();
    }

    public function destroy(Location $location): void
    {
        if ($location->employees()->exists() || $location->assets()->exists()) {
            throw new \RuntimeException('Cannot delete a location that still has employees or assets assigned to it.');
        }

        $location->delete();
    }
}
