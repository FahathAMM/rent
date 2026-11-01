<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Review;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/**
 * The owner dashboard tiles - see app-doc/marketplace/05-ui-and-api-map.md
 * "Owner dashboard tiles (the required set, mapped to data)". Vehicle and
 * Booking are shop-scoped (BelongsToShop), so querying them plainly here
 * already confines to the active shop context; Review is not, so it
 * filters by shop_id explicitly.
 *
 * Omits the "Notifications" tile from that table - no notification is
 * ever created anywhere in the codebase yet (Phase 7), so a permanent
 * zero would be a fake number, not a real one waiting to grow.
 */
class DashboardController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        $shopId = VendorContext::shopId();

        return $this->response('Dashboard retrieved', [
            'listings' => $this->listingCounts(),
            'bookings' => $this->bookingCounts(),
            'revenue' => $this->revenue(),
            'vehicle_utilisation' => $this->utilisation(),
            'listing_performance' => $this->listingPerformance(),
            'reviews' => $this->reviewSummary($shopId),
        ]);
    }

    private function listingCounts(): array
    {
        $byStatus = Vehicle::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');

        return [
            'total' => $byStatus->sum(),
            'published' => $byStatus->get(Vehicle::STATUS_PUBLISHED, 0),
            'draft' => $byStatus->get(Vehicle::STATUS_DRAFT, 0),
            'pending_review' => $byStatus->get(Vehicle::STATUS_PENDING_REVIEW, 0),
            'unpublished' => $byStatus->get(Vehicle::STATUS_UNPUBLISHED, 0),
            'archived' => $byStatus->get(Vehicle::STATUS_ARCHIVED, 0),
            'rejected' => $byStatus->get(Vehicle::STATUS_REJECTED, 0),
            'available_now' => $this->availableNowCount(),
        ];
    }

    /** Published vehicles with no confirmed/active booking spanning today. */
    private function availableNowCount(): int
    {
        $today = now();

        return Vehicle::where('status', Vehicle::STATUS_PUBLISHED)
            ->whereDoesntHave('bookings', fn ($q) => $q
                ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
                ->where('pickup_at', '<=', $today)
                ->where('return_at', '>', $today))
            ->count();
    }

    private function bookingCounts(): array
    {
        $byStatus = Booking::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');

        return [
            'pending' => $byStatus->get(Booking::STATUS_PENDING, 0),
            'confirmed_upcoming' => Booking::where('status', Booking::STATUS_CONFIRMED)->where('pickup_at', '>', now())->count(),
            'active' => $byStatus->get(Booking::STATUS_ACTIVE, 0),
            'completed' => $byStatus->get(Booking::STATUS_COMPLETED, 0),
            'rejected_cancelled_expired' => $byStatus->get(Booking::STATUS_REJECTED, 0)
                + $byStatus->get(Booking::STATUS_EXPIRED, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_CUSTOMER, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_OWNER, 0)
                + $byStatus->get(Booking::STATUS_CANCELLED_BY_ADMIN, 0),
            'no_show' => $byStatus->get(Booking::STATUS_NO_SHOW, 0),
        ];
    }

    /**
     * Money from bookings that are going ahead or done - customers pay the
     * shop directly (cash / bank transfer). Same rules as the Earnings page
     * (Vendor\EarningsController): rental income is the subtotal, and what
     * has been received excludes security-deposit payments (that money goes
     * back) and is capped per booking at its rental income.
     */
    private function revenue(): array
    {
        $bookings = Booking::with(['pricing:id,booking_id,subtotal', 'payments' => fn ($q) => $q
                ->money()
                ->where('status', Payment::STATUS_SUCCEEDED)
                ->where('type', '!=', 'security_deposit')])
            ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED])
            ->get(['id']);

        $income = 0.0;
        $received = 0.0;
        foreach ($bookings as $booking) {
            $rental = (float) ($booking->pricing?->subtotal ?? 0);
            $income += $rental;
            $received += min($rental, (float) $booking->payments->sum(fn ($p) => (float) $p->credit - (float) $p->debit));
        }

        return [
            'rental_income' => round($income, 2),
            'received' => round($received, 2),
            'still_due' => round($income - $received, 2),
        ];
    }

    /** Booked days ÷ available (non-blocked) days over the last 30 days, across every vehicle in the shop. */
    private function utilisation(): array
    {
        $since = now()->subDays(30)->toDateString();

        $rows = VehicleAvailability::whereIn('vehicle_id', Vehicle::pluck('id'))
            ->where('date', '>=', $since)
            ->selectRaw("status, count(*) as count")
            ->groupBy('status')
            ->pluck('count', 'status');

        $booked = $rows->get(VehicleAvailability::STATUS_BOOKED, 0);
        $blocked = $rows->get(VehicleAvailability::STATUS_BLOCKED, 0) + $rows->get(VehicleAvailability::STATUS_MAINTENANCE, 0);
        $totalTracked = $rows->sum();
        $available = max(0, $totalTracked - $blocked);

        return [
            'booked_days' => (int) $booked,
            'available_days' => (int) $available,
            'utilisation_pct' => $available > 0 ? round($booked / $available * 100, 1) : 0.0,
        ];
    }

    /** Top 5 vehicles by booking_count, with the raw counters a conversion rate is built from. */
    private function listingPerformance(): array
    {
        return Vehicle::orderByDesc('booking_count')
            ->limit(5)
            ->get(['id', 'title', 'view_count', 'inquiry_count', 'booking_count'])
            ->map(fn ($v) => [
                'id' => $v->id,
                'title' => $v->title,
                'view_count' => $v->view_count,
                'inquiry_count' => $v->inquiry_count,
                'booking_count' => $v->booking_count,
                'conversion_pct' => $v->view_count > 0 ? round($v->booking_count / $v->view_count * 100, 1) : 0.0,
            ])
            ->all();
    }

    private function reviewSummary(?int $shopId): array
    {
        $row = Review::where('shop_id', $shopId)
            ->where('status', Review::STATUS_PUBLISHED)
            ->selectRaw('count(*) as count, COALESCE(AVG(rating),0) as avg_rating')
            ->first();

        return [
            'count' => (int) $row->count,
            'avg_rating' => round((float) $row->avg_rating, 2),
        ];
    }
}
