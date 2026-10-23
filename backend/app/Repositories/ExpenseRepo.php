<?php

namespace App\Repositories;

use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Models\Expense;
use App\Services\AuthUser;
use App\Support\DocumentTotals;
use App\Support\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ExpenseRepo extends BaseRepository
{
    protected $model;

    public function __construct(Expense $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['expense_number', 'expense_date', 'total', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'expense_date';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->with('category')
            ->when($request->search, fn ($q) =>
                $q->where('expense_number', 'like', "%{$request->search}%")
                  ->orWhere('vendor_name', 'like', "%{$request->search}%")
                  ->orWhere('reference_no', 'like', "%{$request->search}%"))
            ->when($request->category_id, fn ($q) => $q->where('expense_category_id', $request->category_id))
            ->when($request->date_from, fn ($q) => $q->whereDate('expense_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('expense_date', '<=', $request->date_to))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreExpenseRequest $request): Expense
    {
        $data = $request->validated();
        $totals = DocumentTotals::line((float) $data['subtotal'], 1, null, 0, (float) ($data['tax_rate'] ?? 0));

        return $this->model->create($data + [
            'expense_number' => NumberGenerator::next(Tenant::id(), 'expense'),
            'tax_amount'     => $totals['tax_amount'],
            'total'          => $totals['total'],
            'created_by'     => AuthUser::id(),
        ]);
    }

    public function update(Expense $expense, UpdateExpenseRequest $request): Expense
    {
        $data = $request->validated();
        $totals = DocumentTotals::line((float) $data['subtotal'], 1, null, 0, (float) ($data['tax_rate'] ?? 0));

        $expense->update($data + [
            'tax_amount' => $totals['tax_amount'],
            'total'      => $totals['total'],
        ]);

        return $expense->fresh();
    }

    public function destroy(Expense $expense): void
    {
        $expense->delete();
    }
}
