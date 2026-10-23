<?php

namespace App\Repositories;

use App\Http\Requests\Vendor\StoreVendorRequest;
use App\Http\Requests\Vendor\UpdateVendorRequest;
use App\Models\Vendor;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class VendorRepo extends BaseRepository
{
    protected $model;

    public function __construct(Vendor $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'name';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->withCount('purchases')
            ->when($request->search, fn ($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('contact_person', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreVendorRequest $request): Vendor
    {
        return $this->model->create($request->validated());
    }

    public function update(Vendor $vendor, UpdateVendorRequest $request): Vendor
    {
        $vendor->update($request->validated());

        return $vendor->fresh();
    }

    public function destroy(Vendor $vendor): void
    {
        if ($vendor->purchases()->exists()) {
            throw new \RuntimeException('Cannot delete a vendor that has purchases linked to it.');
        }

        $vendor->delete();
    }
}
