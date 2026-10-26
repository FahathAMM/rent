<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\BookingFinancial;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Revenue / commission / payable summary for the active shop — read-only,
 * built on BookingFinancial (the settlement view) scoped through
 * Booking's ShopScope. No shop_id column on booking_financials itself,
 * so every query here filters through whereHas('booking') rather than a
 * direct where() — Eloquent still applies Booking's global scope inside
 * that subquery, so this never needs a manual shop_id filter.
 */
class EarningsController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-finance-earnings-view');
    }

    public function index(Request $request): JsonResponse
    {
        $base = BookingFinancial::query()
            ->whereHas('booking', function ($q) use ($request) {
                if ($request->from) {
                    $q->whereDate('pickup_at', '>=', $request->from);
                }
                if ($request->to) {
                    $q->whereDate('pickup_at', '<=', $request->to);
                }
            });

        $summary = (clone $base)->selectRaw('
                COUNT(*) as bookings_count,
                COALESCE(SUM(gross_rental_amount), 0) as gross_rental_amount,
                COALESCE(SUM(commission_amount), 0) as commission_amount,
                COALESCE(SUM(owner_payable_amount), 0) as owner_payable_amount,
                COALESCE(SUM(refunded_amount), 0) as refunded_amount,
                COALESCE(SUM(CASE WHEN settlement_status = \'paid\' THEN owner_payable_amount ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN settlement_status != \'paid\' THEN owner_payable_amount ELSE 0 END), 0) as pending_amount
            ')->first();

        $byStatus = (clone $base)
            ->selectRaw('settlement_status, COUNT(*) as count, COALESCE(SUM(owner_payable_amount), 0) as amount')
            ->groupBy('settlement_status')
            ->get();

        return $this->response('Earnings summary retrieved', [
            'summary' => $summary,
            'by_status' => $byStatus,
        ]);
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as Api\LocationController::index(). */
    public function bookings(Request $request): JsonResponse
    {
        $sortable = ['gross_rental_amount', 'commission_amount', 'owner_payable_amount', 'settlement_status', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        $rows = BookingFinancial::query()
            ->whereHas('booking', function ($q) use ($request) {
                if ($request->from) {
                    $q->whereDate('pickup_at', '>=', $request->from);
                }
                if ($request->to) {
                    $q->whereDate('pickup_at', '<=', $request->to);
                }
                if ($request->search) {
                    $q->where('booking_reference', 'like', "%{$request->search}%");
                }
            })
            ->with('booking:id,booking_reference,pickup_at,return_at')
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json([
            'record' => $rows,
            'message' => 'Earnings bookings retrieved successfully',
            'status' => true,
        ]);
    }
}
