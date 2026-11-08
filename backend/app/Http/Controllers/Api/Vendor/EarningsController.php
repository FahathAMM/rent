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
