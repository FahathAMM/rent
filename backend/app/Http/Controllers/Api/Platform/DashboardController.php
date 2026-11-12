<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Report;
use App\Models\Review;
use App\Models\SaleEnquiry;
use App\Models\SubscriptionPayment;
use App\Models\Vehicle;
use App\Models\VehicleSale;
use App\Models\VehicleSaleDetail;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

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
            'sales' => $this->sales(),
            'queues' => $this->queues(),
            'community' => $this->community(),
            'trend' => $this->trend(),
            'top_shops' => $this->topShops(),
            'recent_bookings' => $this->recentBookings(),
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

    /** Sales happen at the shop, so these are what shops recorded, not money the platform has seen. */
    private function sales(): array
    {
        return [
            'for_sale' => Vehicle::forSale()->where('status', Vehicle::STATUS_PUBLISHED)
                ->whereHas('saleDetail', fn ($q) => $q->where('sale_status', VehicleSaleDetail::STATUS_AVAILABLE))->count(),
            'open_enquiries' => SaleEnquiry::open()->count(),
            'sold' => VehicleSale::count(),
            'sold_value' => (float) VehicleSale::sum('sale_price'),
        ];
    }

    /** Everything sitting in an admin review queue right now — the whole reason a platform admin opens this dashboard. */
    private function queues(): array
    {
        return [
            'shop_verifications' => RentalShop::where('verification_status', 'pending')->count(),
            'listing_moderation' => Vehicle::whereIn('moderation_status', [Vehicle::MODERATION_PENDING, Vehicle::MODERATION_FLAGGED])->count(),
            'reviews' => Review::where('status', Review::STATUS_PENDING)->count(),
            'disputes' => Dispute::whereIn('status', [Dispute::STATUS_OPEN, Dispute::STATUS_UNDER_REVIEW, Dispute::STATUS_AWAITING_INFO, Dispute::STATUS_ESCALATED])->count(),
            'abuse_reports' => Report::whereIn('status', [Report::STATUS_NEW, Report::STATUS_REVIEWING])->count(),
            'subscription_payments' => SubscriptionPayment::where('status', SubscriptionPayment::STATUS_PENDING)->count(),
            'promotion_requests' => Promotion::where('status', Promotion::STATUS_PENDING)->count(),
        ];
    }

    /** Who is on the marketplace: shops, customers and live vehicles. */
    private function community(): array
    {
        $monthAgo = now()->subDays(30);

        return [
            'shops' => RentalShop::count(),
            'verified_shops' => RentalShop::where('verification_status', 'verified')->count(),
            'new_shops_30d' => RentalShop::where('created_at', '>=', $monthAgo)->count(),
            'customers' => Customer::count(),
            'new_customers_30d' => Customer::where('created_at', '>=', $monthAgo)->count(),
            'published_vehicles' => Vehicle::where('status', Vehicle::STATUS_PUBLISHED)->count(),
        ];
    }

    /**
     * The last 30 days, one row per day: bookings made, their booked value
     * (going-ahead bookings only, like GMV) and new customers. Also totals for
     * this 30 days and the 30 before, so the page can show "+12% vs last month".
     */
    private function trend(): array
    {
        $start = now()->subDays(29)->startOfDay();
        $prevStart = $start->copy()->subDays(30);
        $goingAhead = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

        $bookings = Booking::where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as day, count(*) as count')->groupBy('day')->pluck('count', 'day');
        $value = BookingPricing::join('bookings', 'bookings.id', '=', 'booking_pricing.booking_id')
            ->where('bookings.created_at', '>=', $start)->whereIn('bookings.status', $goingAhead)
            ->selectRaw('DATE(bookings.created_at) as day, sum(booking_pricing.subtotal) as total')->groupBy('day')->pluck('total', 'day');
        $customers = Customer::where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as day, count(*) as count')->groupBy('day')->pluck('count', 'day');

        $days = [];
        for ($d = $start->copy(); $d->lte(now()); $d->addDay()) {
            $key = $d->toDateString();
            $days[] = [
                'date' => $key,
                'bookings' => (int) ($bookings[$key] ?? 0),
                'value' => (float) ($value[$key] ?? 0),
                'customers' => (int) ($customers[$key] ?? 0),
            ];
        }

        $period = fn (Carbon $from, Carbon $to) => [
            'bookings' => Booking::whereBetween('created_at', [$from, $to])->count(),
            'value' => (float) BookingPricing::whereHas('booking', fn ($q) => $q->whereBetween('created_at', [$from, $to])->whereIn('status', $goingAhead))->sum('subtotal'),
            'customers' => Customer::whereBetween('created_at', [$from, $to])->count(),
        ];

        return [
            'days' => $days,
            'current' => $period($start, now()),
            'previous' => $period($prevStart, $start->copy()->subSecond()),
        ];
    }

    /** The five shops with the most bookings in the last 30 days. */
    private function topShops(): array
    {
        $rows = Booking::where('created_at', '>=', now()->subDays(30))
            ->selectRaw('shop_id, count(*) as bookings')->groupBy('shop_id')
            ->orderByDesc('bookings')->limit(5)->get();
        $shops = RentalShop::whereIn('id', $rows->pluck('shop_id'))->get(['id', 'name', 'logo', 'city'])->keyBy('id');

        return $rows->map(fn ($r) => [
            'id' => $r->shop_id,
            'name' => $shops[$r->shop_id]->name ?? '—',
            'logo_url' => $shops[$r->shop_id]->logo_url ?? null,
            'city' => $shops[$r->shop_id]->city ?? null,
            'bookings' => (int) $r->bookings,
        ])->values()->all();
    }

    private function recentBookings(): array
    {
        return Booking::with('vehicle:id,title', 'shop:id,name', 'customer:id,name', 'pricing:id,booking_id,total_payable')
            ->latest()->limit(6)
            ->get(['id', 'booking_reference', 'status', 'vehicle_id', 'shop_id', 'customer_id', 'pickup_at', 'created_at'])
            ->map(fn ($b) => [
                'reference' => $b->booking_reference,
                'status' => $b->status,
                'vehicle' => $b->vehicle?->title,
                'shop' => $b->shop?->name,
                'customer' => $b->customer?->name,
                'total' => $b->pricing ? (float) $b->pricing->total_payable : null,
                'pickup_at' => $b->pickup_at,
                'created_at' => $b->created_at,
            ])->all();
    }
}
