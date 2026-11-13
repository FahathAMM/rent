<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Models\SubscriptionPayment;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * The platform's own books — /platform/accounts, Platform Owner only.
 *
 * Money in is what shops pay the platform: approved subscription payments and approved paid
 * promotions, dated the day an admin approved them. Money out is `platform_expenses`.
 * Booking money is not here: customers pay shops directly, the platform never holds it.
 */
class AccountsController extends Controller
{
    use JsonResponseTrait;

    private const SOURCES = ['subscription', 'promotion', 'expense'];

    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $groups = DB::query()->fromSub($this->ledger($from, $to), 't')
            ->selectRaw("DATE_FORMAT(t.entry_date, '%Y-%m') as month, t.source, COUNT(*) as entries, COALESCE(SUM(t.credit), 0) as credit, COALESCE(SUM(t.debit), 0) as debit")
            ->groupBy('month', 't.source')
            ->get();

        $total = fn (string $source, string $field) => round((float) $groups->where('source', $source)->sum(fn ($g) => (float) $g->{$field}), 2);
        $count = fn (string $source) => (int) $groups->where('source', $source)->sum('entries');

        $subscriptions = $total('subscription', 'credit');
        $promotions = $total('promotion', 'credit');
        $expenses = $total('expense', 'debit');

        // One row per calendar month in the period, including months with nothing in them.
        $months = [];
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonth()) {
            $key = $m->format('Y-m');
            $of = fn (string $source, string $field) => round((float) $groups->where('month', $key)->where('source', $source)->sum(fn ($g) => (float) $g->{$field}), 2);
            $income = round($of('subscription', 'credit') + $of('promotion', 'credit'), 2);
            $out = $of('expense', 'debit');
            $months[] = [
                'month' => $key,
                'subscriptions' => $of('subscription', 'credit'),
                'promotions' => $of('promotion', 'credit'),
                'income' => $income,
                'expenses' => $out,
                'net' => round($income - $out, 2),
            ];
        }

        $topShops = DB::query()->fromSub($this->ledger($from, $to), 't')
            ->where('t.source', '!=', 'expense')
            ->selectRaw('t.shop_id, MAX(t.party) as name, COUNT(*) as payments, SUM(t.credit) as amount')
            ->groupBy('t.shop_id')->orderByDesc('amount')->limit(10)->get()
            ->map(fn ($r) => ['id' => (int) $r->shop_id, 'name' => $r->name, 'payments' => (int) $r->payments, 'amount' => round((float) $r->amount, 2)]);

        $categories = DB::query()->fromSub($this->ledger($from, $to, 'expense'), 't')
            ->selectRaw('t.detail as category, COUNT(*) as entries, SUM(t.debit) as amount')
            ->groupBy('t.detail')->orderByDesc('amount')->get()
            ->map(fn ($r) => ['category' => $r->category, 'entries' => (int) $r->entries, 'amount' => round((float) $r->amount, 2)]);

        // Not income yet: receipts shops have sent that no admin has checked. Not limited to the period.
        $pendingSubscriptions = SubscriptionPayment::where('status', SubscriptionPayment::STATUS_PENDING);
        $pendingPromotions = Promotion::where('status', Promotion::STATUS_PENDING)->where('kind', Promotion::KIND_PAID);

        return $this->response('Accounts summary retrieved', [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'income' => [
                'total' => round($subscriptions + $promotions, 2),
                'subscriptions' => ['count' => $count('subscription'), 'amount' => $subscriptions],
                'promotions' => ['count' => $count('promotion'), 'amount' => $promotions],
            ],
            'expenses' => ['count' => $count('expense'), 'total' => $expenses],
            'net' => round($subscriptions + $promotions - $expenses, 2),
            'pending' => [
                'count' => (clone $pendingSubscriptions)->count() + (clone $pendingPromotions)->count(),
                'amount' => round((float) (clone $pendingSubscriptions)->sum('amount') + (float) (clone $pendingPromotions)->sum('amount'), 2),
            ],
            'months' => $months,
            'top_shops' => $topShops,
            'expense_categories' => $categories,
        ]);
    }

    /** {record, message, status} — ServerDataTable's shape. Newest first. */
    public function transactions(Request $request): JsonResponse
    {
        $rows = $this->filtered($request)->paginate(min(max((int) $request->get('perPage', 20), 1), 100));

        return response()->json(['record' => $rows, 'message' => 'Transactions retrieved', 'status' => true]);
    }

    public function export(Request $request): Response
    {
        [$from, $to] = $this->period($request);
        $rows = $this->filtered($request)->get();

        // Built in memory, not streamed: the platform's own ledger is small (a few lines per shop per month).
        $out = fopen('php://temp', 'w+');
        fwrite($out, "\xEF\xBB\xBF"); // so Excel reads the file as UTF-8
        fputcsv($out, ['Date', 'Reference', 'Type', 'Shop / Paid to', 'Detail', 'Money in', 'Money out']);
        foreach ($rows as $row) {
            fputcsv($out, array_map([$this, 'csvCell'], [
                Carbon::parse($row->entry_date)->toDateString(),
                $row->reference,
                ucfirst($row->source),
                $row->party,
                ucwords(str_replace('_', ' ', (string) $row->detail)) . ($row->note ? " - {$row->note}" : ''),
                (float) $row->credit > 0 ? number_format((float) $row->credit, 2, '.', '') : '',
                (float) $row->debit > 0 ? number_format((float) $row->debit, 2, '.', '') : '',
            ]));
        }
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"platform-accounts-{$from->toDateString()}-to-{$to->toDateString()}.csv\"",
        ]);
    }

    private function filtered(Request $request): Builder
    {
        [$from, $to] = $this->period($request);
        $data = $request->validate([
            'source' => ['nullable', 'in:income,subscription,promotion,expense'],
            'search' => ['nullable', 'string', 'max:100'],
            'shop_id' => ['nullable', 'integer'],
        ]);

        return DB::query()
            ->fromSub($this->ledger($from, $to, $data['source'] ?? null, $data['search'] ?? null, isset($data['shop_id']) ? (int) $data['shop_id'] : null), 't')
            ->orderByDesc('t.entry_date')->orderBy('t.source')->orderByDesc('t.id');
    }

    /**
     * Every line of the books in the period as one query: source, id, reference, entry_date,
     * shop_id, party (the shop, or who an expense was paid to), detail (plan name / promotion
     * type / expense category), note, credit (money in), debit (money out).
     */
    private function ledger(Carbon $from, Carbon $to, ?string $source = null, ?string $search = null, ?int $shopId = null): Builder
    {
        $wanted = match ($source) {
            null => self::SOURCES,
            'income' => ['subscription', 'promotion'],
            default => [$source],
        };
        if ($shopId) {
            $wanted = array_values(array_diff($wanted, ['expense'])); // an expense has no shop
        }
        $like = $search !== null && $search !== '' ? "%{$search}%" : null;

        $parts = [];

        if (in_array('subscription', $wanted, true)) {
            $parts[] = DB::table('subscription_payments as p')
                ->join('rental_shops as s', 's.id', '=', 'p.shop_id')
                ->join('subscription_plans as pl', 'pl.id', '=', 'p.plan_id')
                ->where('p.status', SubscriptionPayment::STATUS_APPROVED)
                ->whereBetween('p.reviewed_at', [$from, $to])
                ->when($shopId, fn ($q) => $q->where('p.shop_id', $shopId))
                ->when($like, fn ($q) => $q->where(fn ($w) => $w->where('p.reference_no', 'like', $like)->orWhere('s.name', 'like', $like)->orWhere('p.bank_reference', 'like', $like)))
                ->selectRaw("'subscription' as source, p.id, p.reference_no as reference, p.reviewed_at as entry_date, p.shop_id, s.name as party, pl.name as detail, p.bank_reference as note, p.amount as credit, 0 as debit");
        }

        if (in_array('promotion', $wanted, true)) {
            $parts[] = DB::table('promotions as p')
                ->join('rental_shops as s', 's.id', '=', 'p.shop_id')
                ->where('p.status', Promotion::STATUS_APPROVED)
                ->where('p.kind', Promotion::KIND_PAID)
                ->whereBetween('p.reviewed_at', [$from, $to])
                ->when($shopId, fn ($q) => $q->where('p.shop_id', $shopId))
                ->when($like, fn ($q) => $q->where(fn ($w) => $w->where('p.reference_no', 'like', $like)->orWhere('s.name', 'like', $like)->orWhere('p.bank_reference', 'like', $like)))
                ->selectRaw("'promotion' as source, p.id, p.reference_no as reference, p.reviewed_at as entry_date, p.shop_id, s.name as party, p.type as detail, p.bank_reference as note, p.amount as credit, 0 as debit");
        }

        if (in_array('expense', $wanted, true)) {
            $parts[] = DB::table('platform_expenses as e')
                ->whereNull('e.deleted_at')
                ->whereBetween('e.expense_date', [$from->toDateString(), $to->toDateString()])
                ->when($like, fn ($q) => $q->where(fn ($w) => $w->where('e.expense_number', 'like', $like)->orWhere('e.paid_to', 'like', $like)->orWhere('e.description', 'like', $like)))
                ->selectRaw("'expense' as source, e.id, e.expense_number as reference, e.expense_date as entry_date, null as shop_id, e.paid_to as party, e.category as detail, e.description as note, 0 as credit, e.amount as debit");
        }

        if (!$parts) {
            // A shop filter together with source=expense: nothing can match.
            return DB::table('platform_expenses as e')->whereRaw('1 = 0')
                ->selectRaw("'expense' as source, e.id, e.expense_number as reference, e.expense_date as entry_date, null as shop_id, e.paid_to as party, e.category as detail, e.description as note, 0 as credit, e.amount as debit");
        }

        $ledger = array_shift($parts);
        foreach ($parts as $part) {
            $ledger->unionAll($part);
        }

        return $ledger;
    }

    /** @return array{0: Carbon, 1: Carbon} Defaults to this year so far. */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $timezone = config('app.timezone');

        return [
            !empty($data['from']) ? Carbon::parse($data['from'], $timezone)->startOfDay() : now()->startOfYear(),
            !empty($data['to']) ? Carbon::parse($data['to'], $timezone)->endOfDay() : now()->endOfDay(),
        ];
    }

    /** Shop names are typed by shops: a leading = + - @ would run as a formula when the file is opened in Excel. */
    private function csvCell($value)
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'{$value}" : $value;
    }
}
