<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Models\Expense;
use App\Repositories\ExpenseRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ExpenseRepo $repo)
    {
        $this->middleware('can:expense-expenses-view')->only(['index', 'show']);
        $this->middleware('can:expense-expenses-create')->only('store');
        $this->middleware('can:expense-expenses-edit')->only('update');
        $this->middleware('can:expense-expenses-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Expenses retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $expense = $this->repo->store($request);

        AuditService::create('Expense', $expense->id, $expense->expense_number);

        return $this->response('Expense created successfully', $expense->load('category'), 201);
    }

    public function show(Expense $expense): JsonResponse
    {
        return $this->response('Expense retrieved successfully', $expense->load(['category', 'createdBy']));
    }

    public function update(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        $old = $expense->only($expense->getFillable());

        $expense = $this->repo->update($expense, $request);

        AuditService::edit('Expense', $expense->id, $expense->expense_number, $old, $expense->only($expense->getFillable()));

        return $this->response('Expense updated successfully', $expense->load('category'));
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $number = $expense->expense_number;
        $this->repo->destroy($expense);

        AuditService::delete('Expense', $expense->id, $number);

        return $this->response('Expense deleted successfully');
    }
}
