<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseCategory\StoreExpenseCategoryRequest;
use App\Http\Requests\ExpenseCategory\UpdateExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use App\Repositories\ExpenseCategoryRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ExpenseCategoryRepo $repo)
    {
        $this->middleware('can:vendor-expense-categories-view')->only(['index', 'show']);
        $this->middleware('can:vendor-expense-categories-create')->only('store');
        $this->middleware('can:vendor-expense-categories-edit')->only('update');
        $this->middleware('can:vendor-expense-categories-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Expense categories retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreExpenseCategoryRequest $request): JsonResponse
    {
        $category = $this->repo->store($request);

        AuditService::create('ExpenseCategory', $category->id, $category->name);

        return $this->response('Category created successfully', $category, 201);
    }

    public function show(ExpenseCategory $expenseCategory): JsonResponse
    {
        return $this->response('Category retrieved successfully', $expenseCategory);
    }

    public function update(UpdateExpenseCategoryRequest $request, ExpenseCategory $expenseCategory): JsonResponse
    {
        $old = $expenseCategory->only($expenseCategory->getFillable());

        $expenseCategory = $this->repo->update($expenseCategory, $request);

        AuditService::edit('ExpenseCategory', $expenseCategory->id, $expenseCategory->name, $old, $expenseCategory->only($expenseCategory->getFillable()));

        return $this->response('Category updated successfully', $expenseCategory);
    }

    public function destroy(ExpenseCategory $expenseCategory): JsonResponse
    {
        try {
            $name = $expenseCategory->name;
            $this->repo->destroy($expenseCategory);

            AuditService::delete('ExpenseCategory', $expenseCategory->id, $name);

            return $this->response('Category deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }
}
