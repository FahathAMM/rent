<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/**
 * "GMV · bookings · queues" - see app-doc/marketplace/05-ui-and-api-map.md.
 * Platform-wide, so every query here is deliberately unscoped (ShopScope
 * already leaves the platform guard unrestricted - see Scopes\ShopScope's
 * docblock branch 2) rather than filtered to any one shop.
 */
class DashboardController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        return $this->response('Dashboard retrieved', [
            'gmv' => $this->gmv(),
            'bookings' => $this->bookingCounts(),
            'queues' => $this->queues(),
        ]);
    }

    /**
     * Gross merchandise value — the rental value (subtotal, before tax and
     * deposit) of every booking that is going ahead or done. Customers pay
     * shops directly, so this is booked value, not money the platform holds.
     */
    private function gmv(): array
    {
        $goingAhead = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

        $total = BookingPricing::whereHas('booking', fn ($q) => $q->whereIn('status', $goingAhead))->sum('subtotal');
        $paidCount = Booking::whereIn('status', $goingAhead)->where('payment_status', Booking::PAYMENT_PAID)->count();

        return ['total' => (float) $total, 'paid_booking_count' => $paidCount];
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

    /** Everything sitting in an admin review queue right now — the whole reason a platform admin opens this dashboard. */
    private function queues(): array
    {
        return [
            'shop_verifications' => RentalShop::where('verification_status', 'pending')->count(),
            'listing_moderation' => Vehicle::whereIn('moderation_status', [Vehicle::MODERATION_PENDING, Vehicle::MODERATION_FLAGGED])->count(),
        ];
    }
}
