<?php

namespace App\Repositories;

use App\Http\Requests\ExpenseCategory\StoreExpenseCategoryRequest;
use App\Http\Requests\ExpenseCategory\UpdateExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ExpenseCategoryRepo extends BaseRepository
{
    protected $model;

    public function __construct(ExpenseCategory $model)
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

    public function store(StoreExpenseCategoryRequest $request): ExpenseCategory
    {
        return $this->model->create($request->validated());
    }

    public function update(ExpenseCategory $category, UpdateExpenseCategoryRequest $request): ExpenseCategory
    {
        $category->update($request->validated());

        return $category->fresh();
    }

    public function destroy(ExpenseCategory $category): void
    {
        if ($category->expenses()->exists()) {
            throw new \RuntimeException('Cannot delete a category that has expenses linked to it.');
        }

        $category->delete();
    }
}
