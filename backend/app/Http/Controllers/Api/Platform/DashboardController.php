<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingFinancial;
use App\Models\OwnerPayout;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/**
 * "GMV · bookings · commission · payouts due · queues" - see
 * app-doc/marketplace/05-ui-and-api-map.md. Platform-wide, so every
 * query here is deliberately unscoped (ShopScope already leaves the
 * platform guard unrestricted - see Scopes\ShopScope's docblock branch
 * 2) rather than filtered to any one shop.
 */
class DashboardController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        return $this->response('Dashboard retrieved', [
            'gmv' => $this->gmv(),
            'bookings' => $this->bookingCounts(),
            'commission' => $this->commission(),
            'payouts_due' => $this->payoutsDue(),
            'queues' => $this->queues(),
        ]);
    }

    /** Gross merchandise value — total actually collected from customers on paid bookings, deposits included (it IS cash collected, just not revenue). */
    private function gmv(): array
    {
        $row = BookingFinancial::whereHas('booking', fn ($q) => $q->where('payment_status', Booking::PAYMENT_PAID))
            ->selectRaw('COALESCE(SUM(customer_paid_amount),0) as gmv, COUNT(*) as paid_booking_count')
            ->first();

        return ['total' => (float) $row->gmv, 'paid_booking_count' => (int) $row->paid_booking_count];
    }

    private function bookingCounts(): array
    {
        $byStatus = Booking::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');

        return [
            'total' => $byStatus->sum(),
            'pending' => $byStatus->get(Booking::STATUS_PENDING, 0),
            'confirmed' => $byStatus->get(Booking::STATUS_CONFIRMED, 0),
            'active' => $byStatus->get(Booking::STATUS_ACTIVE, 0),
            'completed' => $byStatus->get(Booking::STATUS_COMPLETED, 0),
            'cancelled_or_expired' => $byStatus->get(Booking::STATUS_REJECTED, 0)
                + $byStatus->get(Booking::STATUS_EXPIRED, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_CUSTOMER, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_OWNER, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_ADMIN, 0),
        ];
    }

    private function commission(): array
    {
        $row = BookingFinancial::whereHas('booking', fn ($q) => $q->where('payment_status', Booking::PAYMENT_PAID))
            ->selectRaw('COALESCE(SUM(commission_amount),0) as commission_income, COALESCE(SUM(platform_net_amount),0) as platform_net')
            ->first();

        return ['commission_income' => (float) $row->commission_income, 'platform_net' => (float) $row->platform_net];
    }

    /** Owner money committed but not yet transferred — approved/processing/pending-approval payouts, plus unsettled financials not yet even built into a payout. */
    private function payoutsDue(): array
    {
        $inFlight = OwnerPayout::whereIn('status', [OwnerPayout::STATUS_PENDING_APPROVAL, OwnerPayout::STATUS_APPROVED, OwnerPayout::STATUS_PROCESSING])
            ->sum('net_amount');

        $notYetBuilt = BookingFinancial::where('settlement_status', BookingFinancial::SETTLEMENT_UNSETTLED)->sum('owner_payable_amount');

        return [
            'in_flight_payouts' => (float) $inFlight,
            'unsettled_not_yet_built' => (float) $notYetBuilt,
        ];
    }

    /** Everything sitting in an admin review queue right now — the whole reason a platform admin opens this dashboard. */
    private function queues(): array
    {
        return [
            'shop_verifications' => RentalShop::where('verification_status', 'pending')->count(),
            'listing_moderation' => Vehicle::whereIn('moderation_status', [Vehicle::MODERATION_PENDING, Vehicle::MODERATION_FLAGGED])->count(),
            'payout_approvals' => OwnerPayout::where('status', OwnerPayout::STATUS_PENDING_APPROVAL)->count(),
        ];
    }
}
