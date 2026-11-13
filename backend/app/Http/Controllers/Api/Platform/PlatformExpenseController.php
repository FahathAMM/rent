<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformExpense;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** The platform's own costs — the "Expenses" tab of /platform/accounts. Platform Owner only (see routes/platform.php). */
class PlatformExpenseController extends Controller
{
    use JsonResponseTrait;

    /** {record, message, status} — ServerDataTable's shape. */
    public function index(Request $request): JsonResponse
    {
        $sortable = ['expense_date', 'amount', 'category', 'expense_number'];
        $sort = in_array($request->sort_field, $sortable, true) ? $request->sort_field : 'expense_date';
        $dir = $request->sort_direction === 'asc' ? 'asc' : 'desc';

        $expenses = PlatformExpense::with('createdBy:id,name')
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->when($request->from, fn ($q) => $q->whereDate('expense_date', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('expense_date', '<=', $request->to))
            ->when($request->search, fn ($q) => $q->where(fn ($w) => $w
                ->where('expense_number', 'like', "%{$request->search}%")
                ->orWhere('paid_to', 'like', "%{$request->search}%")
                ->orWhere('description', 'like', "%{$request->search}%")
                ->orWhere('reference_no', 'like', "%{$request->search}%")))
            ->orderBy($sort, $dir)->orderByDesc('id')
            ->paginate(min(max((int) $request->get('perPage', 20), 1), 100));

        return response()->json(['record' => $expenses, 'message' => 'Platform expenses retrieved', 'status' => true]);
    }

    public function store(Request $request): JsonResponse
    {
        $expense = PlatformExpense::create($this->validated($request) + [
            'expense_number' => 'PEX-' . Str::upper(Str::random(8)),
            'created_by' => auth('platform')->id(),
        ]);

        AuditService::create('PlatformExpense', $expense->id, $expense->expense_number, $expense->only($expense->getFillable()));

        return $this->response('Expense recorded', $expense, 201);
    }

    public function update(Request $request, PlatformExpense $expense): JsonResponse
    {
        $old = $expense->only($expense->getFillable());
        $expense->update($this->validated($request));

        AuditService::edit('PlatformExpense', $expense->id, $expense->expense_number, $old, $expense->only($expense->getFillable()));

        return $this->response('Expense updated', $expense);
    }

    public function destroy(PlatformExpense $expense): JsonResponse
    {
        $old = $expense->only($expense->getFillable());
        $expense->delete();

        AuditService::delete('PlatformExpense', $expense->id, $expense->expense_number, $old);

        return $this->response('Expense deleted');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'expense_date' => ['required', 'date', 'before_or_equal:' . now()->addYear()->toDateString()],
            'category' => ['required', Rule::in(PlatformExpense::CATEGORIES)],
            'paid_to' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'payment_method' => ['nullable', Rule::in(PlatformExpense::PAYMENT_METHODS)],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
