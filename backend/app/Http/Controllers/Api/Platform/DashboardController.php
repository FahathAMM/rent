<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\Report;
use App\Models\Review;
use App\Models\SubscriptionPayment;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * The platform's own picture: who is on it (vendors, shops, vehicles, customers), what shops
 * have paid the platform (subscriptions, promotions) and what is waiting for an admin.
 *
 * Deliberately nothing about a shop's own business — bookings, booked value and vehicle
 * sales are money between customers and shops, and live on the shop's pages
 * (/platform/bookings, /platform/payments). Platform-wide, so every query is unscoped
 * (ShopScope leaves the platform guard unrestricted — see Scopes\ShopScope).
 */
class DashboardController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        return $this->response('Dashboard retrieved', [
            'income' => $this->income(),
            'community' => $this->community(),
            'queues' => $this->queues(),
            'trend' => $this->trend(),
            'income_months' => $this->incomeMonths(),
            'vehicles_by_category' => $this->vehiclesByCategory(),
            'shops_by_district' => $this->shopsByDistrict(),
            'top_shops' => $this->topShops(),
        ]);
    }

    /** The last 12 calendar months, oldest first: what shops paid the platform, split by what it was for. */
    private function incomeMonths(): array
    {
        $start = now()->startOfMonth()->subMonths(11);
        $perMonth = fn ($query) => $query->where('reviewed_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(reviewed_at, '%Y-%m') as month, sum(amount) as total")->groupBy('month')->pluck('total', 'month');

        $subscriptions = $perMonth($this->subscriptionIncome());
        $promotions = $perMonth($this->promotionIncome());

        $months = [];
        for ($m = $start->copy(); $m->lte(now()); $m->addMonth()) {
            $key = $m->format('Y-m');
            $months[] = [
                'month' => $key,
                'subscriptions' => round((float) ($subscriptions[$key] ?? 0), 2),
                'promotions' => round((float) ($promotions[$key] ?? 0), 2),
            ];
        }

        return $months;
    }

    /** Vehicles per category: the four biggest, and everything else as "Other". */
    private function vehiclesByCategory(): array
    {
        $counts = Vehicle::selectRaw('category_id, count(*) as total')->groupBy('category_id')->orderByDesc('total')->pluck('total', 'category_id');
        $names = VehicleCategory::whereIn('id', $counts->keys()->filter())->pluck('name', 'id');

        $rows = $counts->take(4)->map(fn ($total, $id) => ['name' => $names[$id] ?? 'Uncategorised', 'vehicles' => (int) $total])->values();
        $rest = (int) $counts->slice(4)->sum();

        return $rest > 0 ? $rows->push(['name' => 'Other', 'vehicles' => $rest])->all() : $rows->all();
    }

    /** The five districts with the most shops. */
    private function shopsByDistrict(): array
    {
        return RentalShop::whereNotNull('district')->where('district', '!=', '')
            ->selectRaw('district, count(*) as total')->groupBy('district')->orderByDesc('total')->limit(5)->get()
            ->map(fn ($r) => ['district' => $r->district, 'shops' => (int) $r->total])->all();
    }

    /** Subscription payments an admin approved. */
    private function subscriptionIncome()
    {
        return SubscriptionPayment::where('status', SubscriptionPayment::STATUS_APPROVED);
    }

    /** Promotions a shop paid for and an admin approved (free grants are not money). */
    private function promotionIncome()
    {
        return Promotion::where('status', Promotion::STATUS_APPROVED)->where('kind', Promotion::KIND_PAID);
    }

    /** What shops have paid the platform, all time and this calendar month, plus what is still unchecked. */
    private function income(): array
    {
        $monthStart = now()->startOfMonth();
        $side = fn ($query) => [
            'count' => (clone $query)->count(),
            'amount' => (float) (clone $query)->sum('amount'),
            'this_month' => (float) (clone $query)->where('reviewed_at', '>=', $monthStart)->sum('amount'),
        ];

        $subscriptions = $side($this->subscriptionIncome());
        $promotions = $side($this->promotionIncome());
        $pendingSubscriptions = SubscriptionPayment::where('status', SubscriptionPayment::STATUS_PENDING);
        $pendingPromotions = Promotion::where('status', Promotion::STATUS_PENDING)->where('kind', Promotion::KIND_PAID);

        return [
            'total' => round($subscriptions['amount'] + $promotions['amount'], 2),
            'this_month' => round($subscriptions['this_month'] + $promotions['this_month'], 2),
            'subscriptions' => $subscriptions,
            'promotions' => $promotions,
            'paying_shops' => $this->subscriptionIncome()->distinct()->count('shop_id'),
            'pending' => [
                'count' => (clone $pendingSubscriptions)->count() + (clone $pendingPromotions)->count(),
                'amount' => round((float) (clone $pendingSubscriptions)->sum('amount') + (float) (clone $pendingPromotions)->sum('amount'), 2),
            ],
        ];
    }

    /** Who is on the platform: vendor accounts, shops, vehicles and customers. */
    private function community(): array
    {
        $monthAgo = now()->subDays(30);
        $shopsByStatus = RentalShop::selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');
        $owners = RentalShop::whereNotNull('owner_user_id')->distinct()->count('owner_user_id');
        $vendors = User::whereNotNull('shop_id')->count();

        return [
            // Vendor accounts: everyone who signs in to a shop — its owner and the staff the owner added.
            'vendors' => $vendors,
            'shop_owners' => $owners,
            'shop_staff' => max(0, $vendors - $owners),
            'new_vendors_30d' => User::whereNotNull('shop_id')->where('created_at', '>=', $monthAgo)->count(),

            'shops' => (int) $shopsByStatus->sum(),
            'verified_shops' => RentalShop::where('verification_status', 'verified')->count(),
            'pending_shops' => RentalShop::where('verification_status', 'pending')->count(),
            'suspended_shops' => (int) $shopsByStatus->get('suspended', 0),
            'published_shops' => RentalShop::where('is_published', true)->count(),
            'new_shops_30d' => RentalShop::where('created_at', '>=', $monthAgo)->count(),

            'vehicles' => Vehicle::count(),
            'published_vehicles' => Vehicle::where('status', Vehicle::STATUS_PUBLISHED)->count(),
            'new_vehicles_30d' => Vehicle::where('created_at', '>=', $monthAgo)->count(),

            'customers' => Customer::count(),
            'new_customers_30d' => Customer::where('created_at', '>=', $monthAgo)->count(),
        ];
    }

    /** Everything sitting in an admin review queue right now. */
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

    /**
     * The last 30 days, one row per day: money shops paid the platform (on the day it was
     * approved), new shops, new vehicles and new customers. Also totals for this 30 days
     * and the 30 before, so the page can show "+12% vs last month".
     */
    private function trend(): array
    {
        $start = now()->subDays(29)->startOfDay();
        $prevStart = $start->copy()->subDays(30);

        $perDay = fn ($query, string $column, string $aggregate) => (clone $query)->where($column, '>=', $start)
            ->selectRaw("DATE({$column}) as day, {$aggregate} as total")->groupBy('day')->pluck('total', 'day');

        $subscriptions = $perDay($this->subscriptionIncome(), 'reviewed_at', 'sum(amount)');
        $promotions = $perDay($this->promotionIncome(), 'reviewed_at', 'sum(amount)');
        $shops = $perDay(RentalShop::query(), 'created_at', 'count(*)');
        $vehicles = $perDay(Vehicle::query(), 'created_at', 'count(*)');
        $customers = $perDay(Customer::query(), 'created_at', 'count(*)');

        $days = [];
        for ($d = $start->copy(); $d->lte(now()); $d->addDay()) {
            $key = $d->toDateString();
            $days[] = [
                'date' => $key,
                'income' => round((float) ($subscriptions[$key] ?? 0) + (float) ($promotions[$key] ?? 0), 2),
                'shops' => (int) ($shops[$key] ?? 0),
                'vehicles' => (int) ($vehicles[$key] ?? 0),
                'customers' => (int) ($customers[$key] ?? 0),
            ];
        }

        $period = fn (Carbon $from, Carbon $to) => [
            'income' => round(
                (float) $this->subscriptionIncome()->whereBetween('reviewed_at', [$from, $to])->sum('amount')
                + (float) $this->promotionIncome()->whereBetween('reviewed_at', [$from, $to])->sum('amount'),
                2
            ),
            'shops' => RentalShop::whereBetween('created_at', [$from, $to])->count(),
            'vehicles' => Vehicle::whereBetween('created_at', [$from, $to])->count(),
            'customers' => Customer::whereBetween('created_at', [$from, $to])->count(),
        ];

        return [
            'days' => $days,
            'current' => $period($start, now()),
            'previous' => $period($prevStart, $start->copy()->subSecond()),
        ];
    }

    /** The five shops that have paid the platform the most, all time (subscriptions + promotions). */
    private function topShops(): array
    {
        $subscriptions = $this->subscriptionIncome()->selectRaw('shop_id, sum(amount) as total')->groupBy('shop_id')->pluck('total', 'shop_id');
        $promotions = $this->promotionIncome()->selectRaw('shop_id, sum(amount) as total')->groupBy('shop_id')->pluck('total', 'shop_id');

        $totals = $subscriptions->keys()->merge($promotions->keys())->unique()
            ->mapWithKeys(fn ($id) => [$id => [
                'subscriptions' => (float) ($subscriptions[$id] ?? 0),
                'promotions' => (float) ($promotions[$id] ?? 0),
            ]])
            ->sortByDesc(fn ($t) => $t['subscriptions'] + $t['promotions'])
            ->take(5);
        $shops = RentalShop::whereIn('id', $totals->keys())->get(['id', 'name', 'logo', 'city'])->keyBy('id');

        return $totals->map(fn ($t, $id) => [
            'id' => (int) $id,
            'name' => $shops[$id]->name ?? '—',
            'logo_url' => $shops[$id]->logo_url ?? null,
            'city' => $shops[$id]->city ?? null,
            'subscriptions' => round($t['subscriptions'], 2),
            'promotions' => round($t['promotions'], 2),
            'amount' => round($t['subscriptions'] + $t['promotions'], 2),
        ])->values()->all();
    }
}
