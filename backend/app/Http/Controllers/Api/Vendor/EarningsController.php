<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The shop's earnings per booking, read-only and scoped by Booking's ShopScope.
 *
 * Customers pay the shop directly (cash / bank transfer), so earnings are
 * the rental subtotal and "received" is what the shop has recorded as paid -
 * security-deposit payments excluded (that money is handed back), capped at
 * the booking's earnings.
 */
class EarningsController extends Controller
{
    use JsonResponseTrait;

    /** Statuses where the rental is (or was) actually going ahead. */
    private const EARNING_STATUSES = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

    public function __construct()
    {
        $this->middleware('can:vendor-finance-earnings-view');
    }

    /** One row per booking with rental / earnings / received worked out in SQL. */
    private function rows(Request $request): Builder
    {
        $directReceived = Payment::query()
            ->selectRaw('COALESCE(SUM(credit - debit), 0)')
            ->whereColumn('payments.booking_id', 'bookings.id')
            ->whereNotNull('method') // money lines only - not the booking charge / adjustments
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->where('type', '!=', 'security_deposit');

        $earnings = 'COALESCE(bp.subtotal, 0)';

        return Booking::query()
            ->leftJoin('booking_pricing as bp', 'bp.booking_id', '=', 'bookings.id')
            ->whereIn('bookings.status', self::EARNING_STATUSES)
            ->when($request->from, fn ($q) => $q->whereDate('bookings.pickup_at', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('bookings.pickup_at', '<=', $request->to))
            ->when($request->payment_method, fn ($q) => $q->where('bookings.payment_method', $request->payment_method))
            ->when($request->search, fn ($q) => $q->where('bookings.booking_reference', 'like', "%{$request->search}%"))
            ->select([
                'bookings.id', 'bookings.booking_reference', 'bookings.status', 'bookings.payment_method',
                'bookings.payment_status', 'bookings.pickup_at', 'bookings.return_at', 'bookings.created_at',
                'bp.currency',
                DB::raw("{$earnings} as rental_amount"),
                DB::raw("{$earnings} as earnings_amount"),
            ])
            ->selectRaw("LEAST(({$directReceived->toSql()}), {$earnings}) as received_amount", $directReceived->getBindings());
    }

    public function index(Request $request): JsonResponse
    {
        $summary = DB::query()->fromSub($this->rows($request)->toBase(), 'e')->selectRaw('
                COUNT(*) as bookings_count,
                COALESCE(SUM(rental_amount), 0) as gross_rental_amount,
                COALESCE(SUM(earnings_amount), 0) as earnings_amount,
                COALESCE(SUM(received_amount), 0) as received_amount,
                COALESCE(SUM(earnings_amount - received_amount), 0) as pending_amount
            ')->first();

        $byMethod = DB::query()->fromSub($this->rows($request)->toBase(), 'e')
            ->selectRaw('payment_method, COUNT(*) as count, COALESCE(SUM(earnings_amount), 0) as amount')
            ->groupBy('payment_method')
            ->get();

        return $this->response('Earnings summary retrieved', [
            'summary' => $summary,
            'by_method' => $byMethod,
        ]);
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as Api\LocationController::index(). */
    public function bookings(Request $request): JsonResponse
    {
        $sortable = ['pickup_at', 'rental_amount', 'earnings_amount', 'received_amount', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        $rows = $this->rows($request)
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json([
            'record' => $rows,
            'message' => 'Earnings bookings retrieved successfully',
            'status' => true,
        ]);
    }
}
