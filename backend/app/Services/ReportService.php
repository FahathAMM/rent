<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ItemDailyPrice;
use App\Models\Purchase;
use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Each report returns {columns, rows} where rows are plain associative
 * arrays keyed exactly like `columns`, so the frontend table and every
 * export format (CSV/Excel/PDF, see ReportController) can stay generic
 * instead of one component per report.
 */
class ReportService
{
    private const TYPES = [
        'sales', 'outstanding_sales', 'purchases', 'expenses', 'outstanding_purchases',
        'item_sales', 'profit_margin', 'daily_sales', 'customer_ledger', 'expense_by_category',
    ];

    public static function types(): array
    {
        return self::TYPES;
    }

    public function build(string $type, Request $request): array
    {
        return match ($type) {
            'sales'                 => $this->sales($request),
            'outstanding_sales'     => $this->outstandingSales($request),
            'purchases'             => $this->purchases($request),
            'expenses'              => $this->expenses($request),
            'outstanding_purchases' => $this->outstandingPurchases($request),
            'item_sales'            => $this->itemSales($request),
            'profit_margin'         => $this->profitMargin($request),
            'daily_sales'           => $this->dailySales($request),
            'customer_ledger'       => $this->customerLedger($request),
            'expense_by_category'   => $this->expenseByCategory($request),
            default                 => throw new \InvalidArgumentException("Unknown report type: {$type}"),
        };
    }

    private function sales(Request $request): array
    {
        $rows = Sale::with(['customer', 'items.item'])
            ->where('status', '!=', 'cancelled')
            ->when($request->customer_id, fn ($q) => $q->where('customer_id', $request->customer_id))
            ->when($request->item_id, fn ($q) => $q->whereHas('items', fn ($iq) => $iq->where('item_id', $request->item_id)))
            ->when($request->date_from, fn ($q) => $q->whereDate('sale_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('sale_date', '<=', $request->date_to))
            ->orderByDesc('sale_date')
            ->get()
            ->map(fn (Sale $s) => [
                'Invoice #'  => $s->sale_number,
                'Date'       => $s->sale_date->toDateString(),
                'Customer'   => $s->customer_name,
                'Items'      => $s->items->map(fn ($line) => $line->item?->name ?? $line->description)->implode(', '),
                'Status'     => $s->status,
                'Subtotal'   => $this->money($s->subtotal),
                'Discount'   => $this->money($s->discount_amount),
                'Tax'        => $this->money($s->tax_amount),
                'Total'      => $this->money($s->total),
                'Paid'       => $this->money($s->paid_amount),
                'Balance'    => $this->money($s->balance_amount),
            ]);

        return $this->result($rows);
    }

    /** One row per day (or per month, with ?group_by=month), so trends and busy periods are visible at a glance. */
    private function dailySales(Request $request): array
    {
        $groupByMonth = $request->group_by === 'month';

        $sales = Sale::where('status', '!=', 'cancelled')
            ->when($request->date_from, fn ($q) => $q->whereDate('sale_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('sale_date', '<=', $request->date_to))
            ->orderBy('sale_date')
            ->get();

        $groups = $sales->groupBy(fn (Sale $s) => $groupByMonth ? $s->sale_date->format('Y-m') : $s->sale_date->toDateString());

        $rows = $groups->sortKeys()
            ->map(function (Collection $period) use ($groupByMonth) {
                $first     = $period->first();
                $count     = $period->count();
                $subtotal  = $period->sum(fn (Sale $s) => (float) $s->subtotal);
                $discount  = $period->sum(fn (Sale $s) => (float) $s->discount_amount);
                $tax       = $period->sum(fn (Sale $s) => (float) $s->tax_amount);
                $total     = $period->sum(fn (Sale $s) => (float) $s->total);
                $paid      = $period->sum(fn (Sale $s) => (float) $s->paid_amount);
                $balance   = $period->sum(fn (Sale $s) => (float) $s->balance_amount);

                return [
                    'Period'      => $groupByMonth ? $first->sale_date->format('M Y') : $first->sale_date->format('d M Y'),
                    'Sales Count' => $count,
                    'Subtotal'    => $this->money($subtotal),
                    'Discount'    => $this->money($discount),
                    'Tax'         => $this->money($tax),
                    'Total'       => $this->money($total),
                    'Paid'        => $this->money($paid),
                    'Balance'     => $this->money($balance),
                    'Avg Sale'    => $this->money($count > 0 ? $total / $count : 0),
                ];
            })
            ->values();

        return $this->result($rows);
    }

    /**
     * One row per item, aggregated across every non-cancelled sale in range.
     * Paid/Balance are prorated per line from each sale's header amounts
     * (line total ÷ sale total × sale paid/balance), since payment is
     * recorded per-sale, not per-line.
     */
    private function itemSales(Request $request): array
    {
        $sales = Sale::with(['items.item.unit'])
            ->where('status', '!=', 'cancelled')
            ->when($request->item_id, fn ($q) => $q->whereHas('items', fn ($iq) => $iq->where('item_id', $request->item_id)))
            ->when($request->date_from, fn ($q) => $q->whereDate('sale_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('sale_date', '<=', $request->date_to))
            ->get();

        $summary = [];

        foreach ($sales as $sale) {
            $saleTotal = (float) $sale->total;
            $paidRatio = $saleTotal > 0 ? (float) $sale->paid_amount / $saleTotal : 0.0;

            foreach ($sale->items as $line) {
                if ($request->item_id && (int) $line->item_id !== (int) $request->item_id) {
                    continue;
                }

                $key = $line->item_id ?? 'desc:' . $line->description;

                $summary[$key] ??= [
                    'name'     => $line->item?->name ?? $line->description,
                    'unit'     => $line->item?->unit?->short_name ?? $line->item?->unit?->name,
                    'quantity' => 0.0,
                    'subtotal' => 0.0,
                    'discount' => 0.0,
                    'tax'      => 0.0,
                    'total'    => 0.0,
                    'paid'     => 0.0,
                ];

                $lineTotal = (float) $line->total;

                $summary[$key]['quantity'] += (float) $line->quantity;
                $summary[$key]['subtotal'] += (float) $line->subtotal;
                $summary[$key]['discount'] += (float) $line->discount_amount;
                $summary[$key]['tax']      += (float) $line->tax_amount;
                $summary[$key]['total']    += $lineTotal;
                $summary[$key]['paid']     += $lineTotal * $paidRatio;
            }
        }

        $rows = collect($summary)
            ->map(fn ($s) => [
                'Item'       => $s['name'],
                'Total Unit' => number_format($s['quantity'], 2) . ($s['unit'] ? " ({$s['unit']})" : ''),
                'Total Sale' => $this->money($s['total']),
                'Subtotal'   => $this->money($s['subtotal']),
                'Discount'   => $this->money($s['discount']),
                'Tax'        => $this->money($s['tax']),
                'Total'      => $this->money($s['total']),
                'Paid'       => $this->money($s['paid']),
                'Balance'    => $this->money($s['total'] - $s['paid']),
            ])
            ->sortByDesc(fn ($row) => (float) $row['Total Sale'])
            ->values();

        return $this->result($rows);
    }

    /**
     * One row per item: revenue net of discount (tax is collected on behalf
     * of the government, not real income, so it's excluded) against cost,
     * aggregated across every non-cancelled sale in range. Cost uses that
     * item's ItemDailyPrice.purchase_price on the sale's date when one
     * exists, otherwise falls back to the item's base purchase_price —
     * sale lines don't store a cost snapshot of their own.
     */
    private function profitMargin(Request $request): array
    {
        $sales = Sale::with(['items.item.unit'])
            ->where('status', '!=', 'cancelled')
            ->when($request->item_id, fn ($q) => $q->whereHas('items', fn ($iq) => $iq->where('item_id', $request->item_id)))
            ->when($request->date_from, fn ($q) => $q->whereDate('sale_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('sale_date', '<=', $request->date_to))
            ->get();

        $itemIds = $sales->flatMap(fn (Sale $s) => $s->items->pluck('item_id'))->filter()->unique();

        $dailyCosts = ItemDailyPrice::whereIn('item_id', $itemIds)
            ->get()
            ->groupBy('item_id')
            ->map(fn ($group) => $group->keyBy(fn (ItemDailyPrice $p) => $p->price_date->toDateString()));

        $summary = [];

        foreach ($sales as $sale) {
            $saleDate = $sale->sale_date->toDateString();

            foreach ($sale->items as $line) {
                if ($request->item_id && (int) $line->item_id !== (int) $request->item_id) {
                    continue;
                }

                $key = $line->item_id ?? 'desc:' . $line->description;

                $summary[$key] ??= [
                    'name'     => $line->item?->name ?? $line->description,
                    'unit'     => $line->item?->unit?->short_name ?? $line->item?->unit?->name,
                    'quantity' => 0.0,
                    'revenue'  => 0.0,
                    'cost'     => 0.0,
                ];

                $costPrice = $dailyCosts->get($line->item_id)?->get($saleDate)?->purchase_price
                    ?? $line->item?->purchase_price
                    ?? 0;

                $revenue = (float) $line->subtotal - (float) $line->discount_amount;

                $summary[$key]['quantity'] += (float) $line->quantity;
                $summary[$key]['revenue']  += $revenue;
                $summary[$key]['cost']     += (float) $line->quantity * (float) $costPrice;
            }
        }

        $rows = collect($summary)
            ->map(function ($s) {
                $profit = $s['revenue'] - $s['cost'];
                $margin = $s['revenue'] > 0 ? ($profit / $s['revenue']) * 100 : 0.0;

                return [
                    'Item'       => $s['name'],
                    'Total Unit' => number_format($s['quantity'], 2) . ($s['unit'] ? " ({$s['unit']})" : ''),
                    'Revenue'    => $this->money($s['revenue']),
                    'Cost'       => $this->money($s['cost']),
                    'Profit'     => $this->money($profit),
                    'Margin %'   => number_format($margin, 2),
                ];
            })
            ->sortByDesc(fn ($row) => (float) $row['Profit'])
            ->values();

        return $this->result($rows);
    }

    /** Accounts-receivable-lite: every non-cancelled sale still owed money, oldest first. */
    private function outstandingSales(Request $request): array
    {
        $rows = Sale::with('customer')
            ->where('status', '!=', 'cancelled')
            ->where('balance_amount', '>', 0)
            ->when($request->customer_id, fn ($q) => $q->where('customer_id', $request->customer_id))
            ->orderBy('sale_date')
            ->get()
            ->map(fn (Sale $s) => [
                'Invoice #'    => $s->sale_number,
                'Date'         => $s->sale_date->toDateString(),
                'Due Date'     => $s->due_date?->toDateString(),
                'Customer'     => $s->customer_name,
                'Total'        => $this->money($s->total),
                'Paid'         => $this->money($s->paid_amount),
                'Balance Due'  => $this->money($s->balance_amount),
                'Days Old'     => (int) $s->sale_date->diffInDays(now()),
            ]);

        return $this->result($rows);
    }

    /** One row per customer (walk-ins bucketed by name), ranked by total purchased so top customers surface first. */
    private function customerLedger(Request $request): array
    {
        $sales = Sale::with('customer')
            ->where('status', '!=', 'cancelled')
            ->when($request->customer_id, fn ($q) => $q->where('customer_id', $request->customer_id))
            ->when($request->date_from, fn ($q) => $q->whereDate('sale_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('sale_date', '<=', $request->date_to))
            ->get();

        $summary = [];

        foreach ($sales as $sale) {
            $key = $sale->customer_id ?? 'walkin:' . $sale->customer_name;

            $summary[$key] ??= [
                'name'      => $sale->customer_name,
                'count'     => 0,
                'total'     => 0.0,
                'paid'      => 0.0,
                'balance'   => 0.0,
                'lastSale'  => $sale->sale_date,
            ];

            $summary[$key]['count']++;
            $summary[$key]['total']   += (float) $sale->total;
            $summary[$key]['paid']    += (float) $sale->paid_amount;
            $summary[$key]['balance'] += (float) $sale->balance_amount;

            if ($sale->sale_date->gt($summary[$key]['lastSale'])) {
                $summary[$key]['lastSale'] = $sale->sale_date;
            }
        }

        $rows = collect($summary)
            ->map(fn ($s) => [
                'Customer'        => $s['name'],
                'Sales Count'     => $s['count'],
                'Total Purchased' => $this->money($s['total']),
                'Paid'            => $this->money($s['paid']),
                'Balance Due'     => $this->money($s['balance']),
                'Last Sale'       => $s['lastSale']->toDateString(),
            ])
            ->sortByDesc(fn ($row) => (float) $row['Total Purchased'])
            ->values();

        return $this->result($rows);
    }

    /** One row per category per period (day or month, via ?group_by), so spend trends by category are visible over time. */
    private function expenseByCategory(Request $request): array
    {
        $groupByMonth = $request->group_by === 'month';

        $expenses = Expense::with('category')
            ->when($request->category_id, fn ($q) => $q->where('expense_category_id', $request->category_id))
            ->when($request->date_from, fn ($q) => $q->whereDate('expense_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('expense_date', '<=', $request->date_to))
            ->get();

        $groups = $expenses->groupBy(function (Expense $e) use ($groupByMonth) {
            $period = $groupByMonth ? $e->expense_date->format('Y-m') : $e->expense_date->toDateString();

            return $period . '|' . ($e->category?->name ?? 'Uncategorized');
        });

        $rows = $groups->sortKeys()
            ->map(function (Collection $group) use ($groupByMonth) {
                $first = $group->first();

                return [
                    'Period'   => $groupByMonth ? $first->expense_date->format('M Y') : $first->expense_date->format('d M Y'),
                    'Category' => $first->category?->name ?? 'Uncategorized',
                    'Count'    => $group->count(),
                    'Total'    => $this->money($group->sum(fn (Expense $e) => (float) $e->total)),
                ];
            })
            ->values();

        return $this->result($rows);
    }

    private function purchases(Request $request): array
    {
        $rows = Purchase::with('vendor')
            ->where('status', '!=', 'cancelled')
            ->when($request->vendor_id, fn ($q) => $q->where('vendor_id', $request->vendor_id))
            ->when($request->date_from, fn ($q) => $q->whereDate('purchase_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('purchase_date', '<=', $request->date_to))
            ->orderByDesc('purchase_date')
            ->get()
            ->map(fn (Purchase $p) => [
                'Purchase #'  => $p->purchase_number,
                'Date'        => $p->purchase_date->toDateString(),
                'Vendor'      => $p->vendor?->name,
                'Status'      => $p->status,
                'Subtotal'    => $this->money($p->subtotal),
                'Discount'    => $this->money($p->discount_amount),
                'Tax'         => $this->money($p->tax_amount),
                'Total'       => $this->money($p->total),
                'Paid'        => $this->money($p->paid_amount),
                'Balance'     => $this->money($p->balance_amount),
            ]);

        return $this->result($rows);
    }

    private function expenses(Request $request): array
    {
        $rows = Expense::with('category')
            ->when($request->category_id, fn ($q) => $q->where('expense_category_id', $request->category_id))
            ->when($request->date_from, fn ($q) => $q->whereDate('expense_date', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('expense_date', '<=', $request->date_to))
            ->orderByDesc('expense_date')
            ->get()
            ->map(fn (Expense $e) => [
                'Expense #'  => $e->expense_number,
                'Date'       => $e->expense_date->toDateString(),
                'Category'   => $e->category?->name ?? 'Uncategorized',
                'Paid To'    => $e->vendor_name,
                'Subtotal'   => $this->money($e->subtotal),
                'Tax'        => $this->money($e->tax_amount),
                'Total'      => $this->money($e->total),
                'Method'     => $e->payment_method,
            ]);

        return $this->result($rows);
    }

    /** Accounts-payable-lite: every non-cancelled purchase still owing money, oldest first. */
    private function outstandingPurchases(Request $request): array
    {
        $rows = Purchase::with('vendor')
            ->where('status', '!=', 'cancelled')
            ->where('balance_amount', '>', 0)
            ->when($request->vendor_id, fn ($q) => $q->where('vendor_id', $request->vendor_id))
            ->orderBy('purchase_date')
            ->get()
            ->map(fn (Purchase $p) => [
                'Purchase #'   => $p->purchase_number,
                'Date'         => $p->purchase_date->toDateString(),
                'Due Date'     => $p->due_date?->toDateString(),
                'Vendor'       => $p->vendor?->name,
                'Total'        => $this->money($p->total),
                'Paid'         => $this->money($p->paid_amount),
                'Balance Due'  => $this->money($p->balance_amount),
                'Days Old'     => (int) $p->purchase_date->diffInDays(now()),
            ]);

        return $this->result($rows);
    }

    private function result(Collection $rows): array
    {
        $columns = $rows->isNotEmpty() ? array_keys($rows->first()) : [];

        return ['columns' => $columns, 'rows' => $rows->values()->all()];
    }

    /** Every monetary figure is rendered as a fixed 2-decimal string so the table, CSV/Excel, and PDF all agree. */
    private function money(int|float|string|null $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}
