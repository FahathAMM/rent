<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Expense;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleSale;
use App\Queries\ShopEarningsQuery;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The vendor reports. Every report has the same shape, so one page and one
 * export serve them all: title, summary tiles, columns and rows. Each query
 * is on a shop-scoped model, so it only ever sees the active shop. Not to be
 * confused with ReportService, which handles abuse reports.
 *
 * Column types: text, number, money, percent, date, status.
 */
class ShopReportService
{
    public const REPORTS = [
        'profit-loss', 'vehicles', 'sales', 'bookings', 'outstanding',
        'payments', 'deposits', 'expenses', 'cancellations', 'schedule', 'damage', 'customers',
        'enquiries', 'unsold', 'views', 'promotions', 'reviews', 'response',
    ];

    /** These show today's position, so they take no date range. */
    public const UNDATED = ['outstanding', 'schedule', 'unsold', 'views'];

    public function __construct(private ShopActivityReports $activity) {}

    public function build(string $report, Carbon $from, Carbon $to): array
    {
        return match ($report) {
            'profit-loss' => $this->profitLoss($from, $to),
            'vehicles' => $this->vehicles($from, $to),
            'sales' => $this->sales($from, $to),
            'bookings' => $this->bookings($from, $to),
            'outstanding' => $this->outstanding(),
            'payments' => $this->activity->payments($from, $to),
            'deposits' => $this->activity->deposits($from, $to),
            'expenses' => $this->activity->expenses($from, $to),
            'cancellations' => $this->activity->cancellations($from, $to),
            'schedule' => $this->activity->schedule(),
            'damage' => $this->activity->damage($from, $to),
            'customers' => $this->activity->customers($from, $to),
            'enquiries' => $this->activity->enquiries($from, $to),
            'unsold' => $this->activity->unsold(),
            'views' => $this->activity->views(),
            'promotions' => $this->activity->promotions($from, $to),
            'reviews' => $this->activity->reviews($from, $to),
            'response' => $this->activity->response($from, $to),
        };
    }

    /** Rental income by pickup month (as on Earnings), sales by sold date, expenses by expense date. */
    private function profitLoss(Carbon $from, Carbon $to): array
    {
        $income = DB::query()->fromSub(ShopEarningsQuery::totals($from->toDateString(), $to->toDateString())->toBase(), 'e')
            ->selectRaw("DATE_FORMAT(pickup_at, '%Y-%m') as month, SUM(earnings_amount) as amount")
            ->groupBy('month')->pluck('amount', 'month');

        $sales = VehicleSale::whereBetween('sold_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(sold_at, '%Y-%m') as month, SUM(sale_price) as amount")
            ->groupBy('month')->pluck('amount', 'month');

        $expenses = Expense::whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw("DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(total) as amount")
            ->groupBy('month')->pluck('amount', 'month');

        $rows = $income->keys()->merge($sales->keys())->merge($expenses->keys())->unique()->sort()->values()
            ->map(function (string $month) use ($income, $sales, $expenses) {
                $rental = (float) ($income[$month] ?? 0);
                $sold = (float) ($sales[$month] ?? 0);
                $spent = (float) ($expenses[$month] ?? 0);

                return [
                    'month' => Carbon::createFromFormat('Y-m-d', "{$month}-01")->format('M Y'),
                    'rental_income' => $rental,
                    'vehicle_sales' => $sold,
                    'expenses' => $spent,
                    'net' => $rental + $sold - $spent,
                ];
            });

        return [
            'title' => 'Profit & Loss',
            'description' => 'Income and expenses by month.',
            'note' => 'Vehicle sales are full sale prices. What the shop paid for each car is not recorded, so real profit on sales is lower than shown.',
            'summary' => [
                ['label' => 'Rental income', 'value' => $rows->sum('rental_income'), 'type' => 'money'],
                ['label' => 'Vehicle sales', 'value' => $rows->sum('vehicle_sales'), 'type' => 'money'],
                ['label' => 'Expenses', 'value' => $rows->sum('expenses'), 'type' => 'money'],
                ['label' => 'Net', 'value' => $rows->sum('net'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'month', 'label' => 'Month', 'type' => 'text'],
                ['key' => 'rental_income', 'label' => 'Rental income', 'type' => 'money'],
                ['key' => 'vehicle_sales', 'label' => 'Vehicle sales', 'type' => 'money'],
                ['key' => 'expenses', 'label' => 'Expenses', 'type' => 'money'],
                ['key' => 'net', 'label' => 'Net', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Includes a car that has since moved to sale if it earned in the period, so totals match Profit & Loss. */
    private function vehicles(Carbon $from, Carbon $to): array
    {
        $earned = DB::query()->fromSub(ShopEarningsQuery::totals($from->toDateString(), $to->toDateString())->toBase(), 'e')
            ->selectRaw('vehicle_id, COUNT(*) as bookings, SUM(earnings_amount) as income')
            ->groupBy('vehicle_id')->get()->keyBy('vehicle_id');

        $spent = Expense::whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])->whereNotNull('vehicle_id')
            ->selectRaw('vehicle_id, SUM(total) as amount')->groupBy('vehicle_id')->pluck('amount', 'vehicle_id');

        $vehicles = Vehicle::withTrashed()
            ->where(fn ($q) => $q->where(fn ($r) => $r->forRent()->whereNull('deleted_at'))->orWhereIn('id', $earned->keys()))
            ->get(['id', 'title', 'registration_number', 'view_count']);

        $bookedDays = VehicleAvailability::whereIn('vehicle_id', $vehicles->pluck('id'))
            ->where('status', VehicleAvailability::STATUS_BOOKED)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('vehicle_id, COUNT(*) as days')->groupBy('vehicle_id')->pluck('days', 'vehicle_id');

        // Days already passed, so a period running to the end of the year doesn't dilute the figure.
        $periodDays = max(1, (int) $from->copy()->startOfDay()->diffInDays($to->copy()->min(now())->startOfDay()) + 1);

        $rows = $vehicles->map(function (Vehicle $vehicle) use ($earned, $spent, $bookedDays, $periodDays) {
            $income = (float) ($earned[$vehicle->id]->income ?? 0);
            $cost = (float) ($spent[$vehicle->id] ?? 0);
            $days = (int) ($bookedDays[$vehicle->id] ?? 0);

            return [
                'vehicle' => $vehicle->title,
                'registration' => $vehicle->registration_number,
                'bookings' => (int) ($earned[$vehicle->id]->bookings ?? 0),
                'booked_days' => $days,
                'utilisation' => round(min(100, $days / $periodDays * 100), 1),
                'income' => $income,
                'expenses' => $cost,
                'net' => $income - $cost,
                'views' => (int) $vehicle->view_count,
            ];
        })->sortByDesc('net')->values();

        return [
            'title' => 'Vehicle Performance',
            'description' => 'What each rental vehicle earned and cost, best first.',
            'note' => 'Income is by pickup date. Views are all time. Expenses only count when they are linked to a vehicle.',
            'summary' => [
                ['label' => 'Vehicles', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Income', 'value' => $rows->sum('income'), 'type' => 'money'],
                ['label' => 'Vehicle expenses', 'value' => $rows->sum('expenses'), 'type' => 'money'],
                ['label' => 'Net', 'value' => $rows->sum('net'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'registration', 'label' => 'Registration', 'type' => 'text'],
                ['key' => 'bookings', 'label' => 'Bookings', 'type' => 'number'],
                ['key' => 'booked_days', 'label' => 'Booked days', 'type' => 'number'],
                ['key' => 'utilisation', 'label' => 'Utilisation', 'type' => 'percent'],
                ['key' => 'income', 'label' => 'Income', 'type' => 'money'],
                ['key' => 'expenses', 'label' => 'Expenses', 'type' => 'money'],
                ['key' => 'net', 'label' => 'Net', 'type' => 'money'],
                ['key' => 'views', 'label' => 'Views', 'type' => 'number'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Leaves out the buyer's NIC: a report gets printed and passed around. */
    private function sales(Carbon $from, Carbon $to): array
    {
        $rows = VehicleSale::with('vehicle.saleDetail')->whereBetween('sold_at', [$from, $to])->orderByDesc('sold_at')->get()
            ->map(function (VehicleSale $sale) {
                $asking = (float) ($sale->vehicle?->saleDetail?->price ?? 0);
                $sold = (float) $sale->sale_price;

                return [
                    'sold_at' => $sale->sold_at->toDateString(),
                    'reference' => $sale->reference,
                    'vehicle' => $sale->vehicle?->title,
                    'buyer' => $sale->buyer_name,
                    'payment_method' => ucwords(str_replace('_', ' ', $sale->payment_method)),
                    'asking' => $asking,
                    'sold' => $sold,
                    'difference' => $sold - $asking,
                ];
            });

        return [
            'title' => 'Vehicle Sales',
            'description' => 'Cars sold, and how the price compared with what you asked.',
            'note' => null,
            'summary' => [
                ['label' => 'Cars sold', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Total value', 'value' => $rows->sum('sold'), 'type' => 'money'],
                ['label' => 'Average price', 'value' => $rows->avg('sold') ?? 0, 'type' => 'money'],
                ['label' => 'Below asking', 'value' => -$rows->where('difference', '<', 0)->sum('difference'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'sold_at', 'label' => 'Sold', 'type' => 'date'],
                ['key' => 'reference', 'label' => 'Reference', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'buyer', 'label' => 'Buyer', 'type' => 'text'],
                ['key' => 'payment_method', 'label' => 'Paid by', 'type' => 'text'],
                ['key' => 'asking', 'label' => 'Asking', 'type' => 'money'],
                ['key' => 'sold', 'label' => 'Sold for', 'type' => 'money'],
                ['key' => 'difference', 'label' => 'Difference', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    private function bookings(Carbon $from, Carbon $to): array
    {
        $bookings = Booking::with(['vehicle:id,title', 'customer:id,name', 'pricing:id,booking_id,subtotal'])
            ->whereBetween('pickup_at', [$from, $to])->orderByDesc('pickup_at')->get();

        $goingAhead = $bookings->whereIn('status', ShopEarningsQuery::STATUSES);

        return [
            'title' => 'Bookings',
            'description' => 'Every booking by pickup date, in any status.',
            'note' => null,
            'summary' => [
                ['label' => 'Bookings', 'value' => $bookings->count(), 'type' => 'number'],
                ['label' => 'Going ahead', 'value' => $goingAhead->count(), 'type' => 'number'],
                ['label' => 'Lost', 'value' => $bookings->count() - $goingAhead->count() - $bookings->where('status', Booking::STATUS_PENDING)->count(), 'type' => 'number'],
                ['label' => 'Value going ahead', 'value' => $goingAhead->sum(fn (Booking $b) => (float) ($b->pricing?->subtotal ?? 0)), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'pickup_at', 'label' => 'Pickup', 'type' => 'date'],
                ['key' => 'return_at', 'label' => 'Return', 'type' => 'date'],
                ['key' => 'days', 'label' => 'Days', 'type' => 'number'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'value', 'label' => 'Value', 'type' => 'money'],
            ],
            'rows' => $bookings->map(fn (Booking $b) => [
                'reference' => $b->booking_reference,
                'vehicle' => $b->vehicle?->title,
                'customer' => $b->customer?->name,
                'pickup_at' => $b->pickup_at?->toDateString(),
                'return_at' => $b->return_at?->toDateString(),
                'days' => (int) $b->rental_days,
                'status' => $b->status,
                'value' => (float) ($b->pricing?->subtotal ?? 0),
            ])->values()->all(),
        ];
    }

    /** Everything owed today, so it ignores the date range: an old debt shouldn't vanish from a short period. */
    private function outstanding(): array
    {
        // Only bookings still owing, filtered in SQL (MySQL allows HAVING on select aliases).
        $rows = ShopEarningsQuery::totals()->havingRaw('earnings_amount > received_amount')
            ->with(['vehicle:id,title', 'customer:id,name,phone'])->orderBy('bookings.pickup_at')->orderBy('bookings.id')->get()
            ->map(fn ($b) => [
                'reference' => $b->booking_reference,
                'customer' => $b->customer?->name,
                'phone' => $b->customer?->phone,
                'vehicle' => $b->vehicle?->title,
                'pickup_at' => $b->pickup_at?->toDateString(),
                'status' => $b->status,
                'total' => (float) $b->earnings_amount,
                'received' => (float) $b->received_amount,
                'due' => (float) $b->earnings_amount - (float) $b->received_amount,
            ])->values();

        return [
            'title' => 'Outstanding Balances',
            'description' => 'Confirmed, active and completed bookings with money still to receive.',
            'note' => 'Shows everything owed today. A booking that has not started yet may simply be paid at pickup.',
            'summary' => [
                ['label' => 'Bookings', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Still to receive', 'value' => $rows->sum('due'), 'type' => 'money'],
                ['label' => 'From completed', 'value' => $rows->where('status', Booking::STATUS_COMPLETED)->sum('due'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'pickup_at', 'label' => 'Pickup', 'type' => 'date'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'total', 'label' => 'Total', 'type' => 'money'],
                ['key' => 'received', 'label' => 'Received', 'type' => 'money'],
                ['key' => 'due', 'label' => 'Due', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }
}
