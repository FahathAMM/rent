<?php

namespace App\Repositories;

use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Models\Customer;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class CustomerRepo extends BaseRepository
{
    protected $model;

    public function __construct(Customer $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'name';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->withCount('sales')
            ->when($request->search, fn ($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('phone', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreCustomerRequest $request): Customer
    {
        return $this->model->create($request->validated());
    }

    public function update(Customer $customer, UpdateCustomerRequest $request): Customer
    {
        $customer->update($request->validated());

        return $customer->fresh();
    }

    public function destroy(Customer $customer): void
    {
        if ($customer->sales()->exists()) {
            throw new \RuntimeException('Cannot delete a customer that has sales linked to it.');
        }

        $customer->delete();
    }
}
