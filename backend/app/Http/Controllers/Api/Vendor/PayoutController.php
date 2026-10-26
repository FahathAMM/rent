<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\OwnerPayout;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only — the shop's own payout history. OwnerPayout has no
 * BelongsToShop/ShopScope (it's not a per-request-context-sensitive
 * model the way Vehicle/Booking are), so shop_id is filtered explicitly
 * here rather than relying on a global scope.
 */
class PayoutController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $sortable = ['period_start', 'period_end', 'net_amount', 'status', 'paid_at', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        $payouts = OwnerPayout::where('shop_id', VendorContext::shopId())
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where('payout_reference', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $payouts, 'message' => 'Payouts retrieved', 'status' => true]);
    }

    public function show(OwnerPayout $payout): JsonResponse
    {
        abort_unless($payout->shop_id === VendorContext::shopId(), 404);

        $payout->load('items.booking:id,booking_reference,pickup_at,return_at');

        return response()->json(['record' => $payout, 'message' => 'Payout retrieved', 'status' => true]);
    }
}
