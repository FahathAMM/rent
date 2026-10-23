<?php

namespace App\Services;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function getSummary(): array
    {
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $endOfMonth = $now->copy()->endOfMonth();
        $sixMonthsAgo = $now->copy()->subMonths(5)->startOfMonth();

        $salesThisMonth = (float) Sale::where('status', '!=', 'cancelled')
            ->whereBetween('sale_date', [$startOfMonth, $endOfMonth])->sum('total');
        $purchasesThisMonth = (float) Purchase::where('status', '!=', 'cancelled')
            ->whereBetween('purchase_date', [$startOfMonth, $endOfMonth])->sum('total');
        $expensesThisMonth = (float) Expense::whereBetween('expense_date', [$startOfMonth, $endOfMonth])->sum('total');

        return [
            'company_name' => Auth::user()?->company?->name,
            'kpis' => [
                'sales_this_month'      => $salesThisMonth,
                'purchases_this_month'  => $purchasesThisMonth,
                'expenses_this_month'   => $expensesThisMonth,
                'net_profit_this_month' => round($salesThisMonth - $purchasesThisMonth - $expensesThisMonth, 2),
                'receivables'           => (float) Sale::where('status', '!=', 'cancelled')->where('balance_amount', '>', 0)->sum('balance_amount'),
                'payables'              => (float) Purchase::where('status', '!=', 'cancelled')->where('balance_amount', '>', 0)->sum('balance_amount'),
                'total_vendors'         => Vendor::count(),
                'total_customers'       => Customer::count(),
            ],
            'cash_flow_trend'   => $this->cashFlowTrend($sixMonthsAgo),
            'expense_breakdown' => $this->expenseBreakdown($sixMonthsAgo, $endOfMonth),
            'purchase_status'   => $this->purchaseStatusBreakdown(),
            'top_vendors'       => $this->topVendors($sixMonthsAgo, $endOfMonth),
            'top_items'         => $this->topItems($sixMonthsAgo, $endOfMonth),
            'recent_purchases'  => $this->recentPurchases(),
            'recent_sales'      => $this->recentSales(),
            'recent_expenses'   => $this->recentExpenses(),
            'overall' => [
                'total_users'  => User::count(),
                'active_users' => User::where('is_active', true)->count(),
            ],
            'recent_audit_logs' => AuditLog::with('user')->latest()->limit(10)->get(),
        ];
    }

    /** Last 6 months (oldest first) of sales revenue vs purchase spend vs expenses. */
    private function cashFlowTrend(Carbon $from): array
    {
        $months = collect(range(5, 0))->map(fn ($i) => Carbon::now()->subMonths($i)->startOfMonth());

        $salesByMonth = Sale::selectRaw("DATE_FORMAT(sale_date, '%Y-%m') as ym, SUM(total) as total")
            ->where('sale_date', '>=', $from)
            ->where('status', '!=', 'cancelled')
            ->groupBy('ym')
            ->pluck('total', 'ym');

        $purchasesByMonth = Purchase::selectRaw("DATE_FORMAT(purchase_date, '%Y-%m') as ym, SUM(total) as total")
            ->where('purchase_date', '>=', $from)
            ->where('status', '!=', 'cancelled')
            ->groupBy('ym')
            ->pluck('total', 'ym');

        $expensesByMonth = Expense::selectRaw("DATE_FORMAT(expense_date, '%Y-%m') as ym, SUM(total) as total")
            ->where('expense_date', '>=', $from)
            ->groupBy('ym')
            ->pluck('total', 'ym');

        return $months->map(function (Carbon $month) use ($salesByMonth, $purchasesByMonth, $expensesByMonth) {
            $key = $month->format('Y-m');

            return [
                'month'     => $month->format('M Y'),
                'sales'     => (float) ($salesByMonth[$key] ?? 0),
                'purchases' => (float) ($purchasesByMonth[$key] ?? 0),
                'expenses'  => (float) ($expensesByMonth[$key] ?? 0),
            ];
        })->values()->all();
    }

    private function expenseBreakdown(Carbon $from, Carbon $to): array
    {
        return Expense::query()
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->whereBetween('expense_date', [$from, $to])
            ->groupBy('expense_categories.id', 'expense_categories.name')
            ->orderByDesc(DB::raw('SUM(expenses.total)'))
            ->limit(6)
            ->get(['expense_categories.name as category', DB::raw('SUM(expenses.total) as total')])
            ->map(fn ($row) => ['category' => $row->category, 'total' => (float) $row->total])
            ->all();
    }

    private function purchaseStatusBreakdown(): array
    {
        $counts = Purchase::query()->select('status', DB::raw('COUNT(*) as count'))->groupBy('status')->pluck('count', 'status');

        return collect(['pending', 'received', 'cancelled'])
            ->map(fn ($status) => ['status' => $status, 'count' => (int) ($counts[$status] ?? 0)])
            ->filter(fn ($row) => $row['count'] > 0)
            ->values()
            ->all();
    }

    /** Vendors with the highest purchase spend in the last 6 months. */
    private function topVendors(Carbon $from, Carbon $to): array
    {
        return Purchase::query()
            ->join('vendors', 'vendors.id', '=', 'purchases.vendor_id')
            ->whereBetween('purchases.purchase_date', [$from, $to])
            ->where('purchases.status', '!=', 'cancelled')
            ->groupBy('vendors.id', 'vendors.name')
            ->orderByDesc(DB::raw('SUM(purchases.total)'))
            ->limit(6)
            ->get(['vendors.name as vendor', DB::raw('SUM(purchases.total) as total')])
            ->map(fn ($row) => ['vendor' => $row->vendor, 'total' => (float) $row->total])
            ->all();
    }

    /** Items with the highest sales revenue in the last 6 months. */
    private function topItems(Carbon $from, Carbon $to): array
    {
        return Sale::query()
            ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
            ->join('items', 'items.id', '=', 'sale_items.item_id')
            ->whereBetween('sales.sale_date', [$from, $to])
            ->where('sales.status', '!=', 'cancelled')
            ->groupBy('items.id', 'items.name')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->limit(6)
            ->get(['items.name as item', DB::raw('SUM(sale_items.total) as total')])
            ->map(fn ($row) => ['item' => $row->item, 'total' => (float) $row->total])
            ->all();
    }

    private function recentPurchases(): array
    {
        return Purchase::with('vendor:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Purchase $p) => [
                'id'              => $p->id,
                'purchase_number' => $p->purchase_number,
                'vendor'          => $p->vendor?->name,
                'total'           => (float) $p->total,
                'status'          => $p->status,
                'purchase_date'   => $p->purchase_date?->toDateString(),
            ])->all();
    }

    private function recentSales(): array
    {
        return Sale::with('customer:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Sale $s) => [
                'id'         => $s->id,
                'sale_number'=> $s->sale_number,
                'customer'   => $s->customer_name,
                'total'      => (float) $s->total,
                'status'     => $s->status,
                'sale_date'  => $s->sale_date?->toDateString(),
            ])->all();
    }

    private function recentExpenses(): array
    {
        return Expense::with('category:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Expense $e) => [
                'id'             => $e->id,
                'expense_number' => $e->expense_number,
                'category'       => $e->category?->name,
                'total'          => (float) $e->total,
                'expense_date'   => $e->expense_date?->toDateString(),
            ])->all();
    }
}
