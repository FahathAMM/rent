<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Review;
use App\Models\SaleEnquiry;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehicleSale;
use App\Models\VehicleSaleDetail;
use App\Queries\ShopEarningsQuery;
use App\Services\AuthUser;
use App\Services\SubscriptionService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

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

    public function __construct()
    {
        $this->middleware('can:vendor-dashboard-view');
    }

    public function index(): JsonResponse
    {
        $shopId = VendorContext::shopId();
        // The shop's money (revenue, income trend, sale value) only for those who may see earnings.
        $seesMoney = AuthUser::can('vendor-finance-earnings-view');

        $sales = $this->salesSummary($shopId);
        if ($sales && !$seesMoney) {
            $sales['sold_value_this_month'] = null;
        }

        return $this->response('Dashboard retrieved', [
            'listings' => $this->listingCounts(),
            'sales' => $sales,
            'bookings' => $this->bookingCounts(),
            'revenue' => $seesMoney ? $this->revenue() : null,
            'vehicle_utilisation' => $this->utilisation(),
            'listing_performance' => $this->listingPerformance(),
            'reviews' => $this->reviewSummary($shopId),
            'today' => $this->today(),
            'attention' => $this->attentionCounts(),
            'income_trend' => $seesMoney ? $this->incomeTrend() : [],
            'recent_bookings' => $this->recentBookings(),
            'can_view_money' => $seesMoney,
        ]);
    }

    /** Null when the shop's plan has no sales, so the dashboard shows nothing about them. */
    private function salesSummary(?int $shopId): ?array
    {
        if (!$shopId || !app(SubscriptionService::class)->hasFeature($shopId, 'sales')) {
            return null;
        }

        $soldThisMonth = VehicleSale::where('sold_at', '>=', now()->startOfMonth());

        return [
            'for_sale' => Vehicle::forSale()->where('status', Vehicle::STATUS_PUBLISHED)
                ->whereHas('saleDetail', fn ($q) => $q->where('sale_status', VehicleSaleDetail::STATUS_AVAILABLE))->count(),
            'enquiries_waiting' => SaleEnquiry::where('status', SaleEnquiry::STATUS_NEW)->count(),
            'sold_this_month' => (clone $soldThisMonth)->count(),
            'sold_value_this_month' => (float) (clone $soldThisMonth)->sum('sale_price'),
        ];
    }

    private function listingCounts(): array
    {
        $byStatus = Vehicle::forRent()->selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');

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

        return Vehicle::forRent()->where('status', Vehicle::STATUS_PUBLISHED)
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

    /** Time-sensitive work that can otherwise get buried in the full booking list. */
    private function attentionCounts(): array
    {
        return [
            'pending_transfers' => Payment::where('method', Payment::METHOD_BANK)
                ->where('status', Payment::STATUS_PENDING)
                ->whereHas('booking', fn ($q) => $q->where('status', Booking::STATUS_CONFIRMED))
                ->count(),
            'overdue_returns' => Booking::where('status', Booking::STATUS_ACTIVE)
                ->where('return_at', '<', now())
                ->count(),
        ];
    }

    /**
     * Money from bookings that are going ahead or done - customers pay the
     * shop directly (cash / bank transfer). Same rules as the Earnings page
     * (Vendor\EarningsController): income is the subtotal plus any deposit kept
     * for damage; received excludes security-deposit payments (that money goes
     * back) but includes the kept damage, capped per booking at its income.
     */
    private function revenue(): array
    {
        // Added up in SQL by the Earnings page's own query, so the two can't disagree
        // (loading every booking and payment into PHP took seconds on a busy shop).
        $totals = DB::query()->fromSub(ShopEarningsQuery::totals()->toBase(), 'e')
            ->selectRaw('COALESCE(SUM(earnings_amount), 0) as income, COALESCE(SUM(received_amount), 0) as received')
            ->first();
        $income = (float) $totals->income;
        $received = (float) $totals->received;

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

        $rows = VehicleAvailability::whereIn('vehicle_id', Vehicle::forRent()->pluck('id'))
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
        return Vehicle::forRent()->orderByDesc('booking_count')
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

    /** Pickups and returns due today - the vendor's to-do list for the day. */
    private function today(): array
    {
        $row = fn (Booking $b, $at) => [
            'reference' => $b->booking_reference,
            'customer' => $b->customer?->name,
            'vehicle' => $b->vehicle?->title,
            'at' => $at,
        ];

        $pickups = Booking::with(['customer:id,name', 'vehicle:id,title'])
            ->where('status', Booking::STATUS_CONFIRMED)
            ->whereDate('pickup_at', today())
            ->orderBy('pickup_at')
            ->get()
            ->map(fn ($b) => $row($b, $b->pickup_at));

        $returns = Booking::with(['customer:id,name', 'vehicle:id,title'])
            ->where('status', Booking::STATUS_ACTIVE)
            ->whereDate('return_at', '<=', today())
            ->orderBy('return_at')
            ->get()
            ->map(fn ($b) => $row($b, $b->return_at) + ['overdue' => $b->return_at->lt(now())]);

        return ['pickups' => $pickups->all(), 'returns' => $returns->all()];
    }

    /** Rental income (subtotal) per month for the last 6 months, by pickup month. */
    private function incomeTrend(): array
    {
        $start = now()->startOfMonth()->subMonths(5);

        // pickup_at is stored in the app's timezone, so its YYYY-MM is the same month PHP would see.
        $totals = Booking::query()
            ->leftJoin('booking_pricing as bp', 'bp.booking_id', '=', 'bookings.id')
            ->whereIn('bookings.status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED])
            ->where('bookings.pickup_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(bookings.pickup_at, '%Y-%m') as ym, COALESCE(SUM(bp.subtotal), 0) as income, COUNT(*) as bookings")
            ->groupBy('ym')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->ym => [
                'income' => round((float) $row->income, 2),
                'bookings' => (int) $row->bookings,
            ]]);

        return collect(range(0, 5))->map(function ($i) use ($start, $totals) {
            $month = $start->copy()->addMonths($i);
            $key = $month->format('Y-m');

            return [
                'month' => $month->format('M'),
                'income' => $totals[$key]['income'] ?? 0,
                'bookings' => $totals[$key]['bookings'] ?? 0,
            ];
        })->all();
    }

    private function recentBookings(): array
    {
        return Booking::with(['customer:id,name', 'vehicle:id,title', 'pricing:id,booking_id,total_payable'])
            ->latest()
            ->latest('id') // stable order when several bookings share a created_at
            ->limit(6)
            ->get()
            ->map(fn ($b) => [
                'reference' => $b->booking_reference,
                'customer' => $b->customer?->name,
                'vehicle' => $b->vehicle?->title,
                'pickup_at' => $b->pickup_at,
                'return_at' => $b->return_at,
                'status' => $b->status,
                'total' => (float) ($b->pricing?->total_payable ?? 0),
            ])
            ->all();
    }
}
