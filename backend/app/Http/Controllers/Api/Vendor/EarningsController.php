<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Queries\ShopEarningsQuery;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** The shop's earnings per booking, read-only. The figures come from ShopEarningsQuery. */
class EarningsController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-finance-earnings-view');
    }

    private function rows(Request $request): Builder
    {
        return ShopEarningsQuery::rows($request->from, $request->to, $request->payment_method, $request->search);
    }

    public function index(Request $request): JsonResponse
    {
        // One pass, grouped by payment method; the overall summary is the sum of the groups.
        $groups = DB::query()
            ->fromSub(ShopEarningsQuery::totals($request->from, $request->to, $request->payment_method, $request->search)->toBase(), 'e')
            ->selectRaw('
                payment_method,
                COUNT(*) as bookings_count,
                COALESCE(SUM(rental_amount), 0) as gross_rental_amount,
                COALESCE(SUM(earnings_amount), 0) as earnings_amount,
                COALESCE(SUM(received_amount), 0) as received_amount
            ')
            ->groupBy('payment_method')
            ->get();

        $sum = fn (string $field) => number_format((float) $groups->sum(fn ($g) => (float) $g->{$field}), 2, '.', '');

        return $this->response('Earnings summary retrieved', [
            'summary' => [
                'bookings_count' => (int) $groups->sum('bookings_count'),
                'gross_rental_amount' => $sum('gross_rental_amount'),
                'earnings_amount' => $sum('earnings_amount'),
                'received_amount' => $sum('received_amount'),
                'pending_amount' => number_format((float) $groups->sum(fn ($g) => (float) $g->earnings_amount - (float) $g->received_amount), 2, '.', ''),
            ],
            'by_method' => $groups->map(fn ($g) => [
                'payment_method' => $g->payment_method,
                'count' => (int) $g->bookings_count,
                'amount' => $g->earnings_amount,
            ])->values(),
        ]);
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as LocationController::index(). */
    public function bookings(Request $request): JsonResponse
    {
        $sortable = ['pickup_at', 'rental_amount', 'earnings_amount', 'received_amount', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        // Sorting by a money column needs every booking's figures anyway, so use the
        // one-pass shape for that; otherwise only the page's rows are worked out.
        $byAmount = in_array($sort, ['rental_amount', 'earnings_amount', 'received_amount'], true);
        $perPage = min((int) $request->get('perPage', 20), 100);
        $query = ($byAmount
                ? ShopEarningsQuery::totals($request->from, $request->to, $request->payment_method, $request->search)
                : $this->rows($request))
            ->orderBy($sort, $dir)
            ->orderBy('bookings.id', $dir); // stable pages when amounts tie

        // The page count comes from the plain rows (no payment join), which always gives the same number.
        $rows = $query->paginate($perPage, ['*'], 'page', null, fn () => $this->rows($request)->toBase()->getCountForPagination());

        return response()->json([
            'record' => $rows,
            'message' => 'Earnings bookings retrieved successfully',
            'status' => true,
        ]);
    }
}
