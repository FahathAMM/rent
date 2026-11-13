<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Dispute;
use App\Models\PublicVisit;
use App\Models\Report;
use App\Models\Review;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Services\PlatformReportService as R;

/**
 * The second half of the platform reports (see PlatformReportService): marketplace
 * activity, trust and safety, and system. Plain query-builder reads across every shop.
 */
class PlatformActivityReports
{
    private const GOING_AHEAD = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

    private const LOST = [
        Booking::STATUS_REJECTED, Booking::STATUS_EXPIRED, Booking::STATUS_CANCELLED_BY_CUSTOMER,
        Booking::STATUS_CANCELLED_BY_OWNER, Booking::STATUS_CANCELLED_BY_ADMIN, Booking::STATUS_NO_SHOW,
    ];

    /** The audit log can be very long; the report shows the newest lines up to this many. */
    private const ACTIVITY_LIMIT = 2000;

    private static function date($value): ?string
    {
        return $value ? Carbon::parse($value)->toDateString() : null;
    }

    private static function words(?string $value): ?string
    {
        return $value === null || $value === '' ? null : ucfirst(str_replace('_', ' ', $value));
    }

    private static function quoted(array $values): string
    {
        return "'" . implode("','", $values) . "'";
    }

    /* ─── Marketplace activity ────────────────────────────────────────── */

    /** Today's listings, one row per vehicle. */
    public function vehicleListings(): array
    {
        $rows = DB::table('vehicles as v')->join('rental_shops as s', 's.id', '=', 'v.shop_id')
            ->leftJoin('vehicle_categories as c', 'c.id', '=', 'v.category_id')
            ->whereNull('v.deleted_at')->orderBy('s.name')->orderBy('v.title')
            ->get(['v.title', 'v.make', 'v.year', 'v.registration_number', 'v.listing_type', 'v.status', 'v.moderation_status', 'v.view_count', 'v.created_at', 's.name as shop', 's.district', 'c.name as category'])
            ->map(fn ($v) => [
                'vehicle' => $v->title,
                'shop' => $v->shop,
                'district' => $v->district,
                'category' => $v->category,
                'brand' => $v->make,
                'year' => $v->year,
                'registration' => $v->registration_number,
                'listing' => $v->listing_type === Vehicle::LISTING_SALE ? 'For sale' : 'For rent',
                'status' => $v->status,
                'moderation' => $v->moderation_status,
                'views' => (int) $v->view_count,
                'added' => self::date($v->created_at),
            ]);

        return [
            'summary' => [
                R::tile('Vehicles', $rows->count()),
                R::tile('Live on the site', $rows->where('status', Vehicle::STATUS_PUBLISHED)->count()),
                R::tile('Waiting for moderation', $rows->whereIn('moderation', [Vehicle::MODERATION_PENDING, Vehicle::MODERATION_FLAGGED])->count()),
                R::tile('For sale', $rows->where('listing', 'For sale')->count()),
            ],
            'columns' => [
                R::col('vehicle', 'Vehicle'), R::col('shop', 'Shop'), R::col('district', 'District'), R::col('category', 'Category'),
                R::col('brand', 'Brand'), R::col('year', 'Year'), R::col('registration', 'Registration'), R::col('listing', 'Listing'),
                R::col('status', 'Status', 'status'), R::col('moderation', 'Moderation', 'status'), R::col('views', 'Views', 'number'), R::col('added', 'Added', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Per shop, by the day a booking was made. Booked value is the rental value of bookings going ahead. */
    public function bookingsSummary(Carbon $from, Carbon $to): array
    {
        $going = self::quoted(self::GOING_AHEAD);
        $lost = self::quoted(self::LOST);

        $rows = DB::table('bookings as b')->join('rental_shops as s', 's.id', '=', 'b.shop_id')
            ->leftJoin('booking_pricing as p', 'p.booking_id', '=', 'b.id')
            ->whereNull('b.deleted_at')->whereBetween('b.created_at', [$from, $to])
            ->selectRaw("
                s.name as shop, s.district,
                COUNT(DISTINCT b.id) as bookings,
                COUNT(DISTINCT CASE WHEN b.status IN ({$going}) THEN b.id END) as going_ahead,
                COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed,
                COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) as pending,
                COUNT(DISTINCT CASE WHEN b.status IN ({$lost}) THEN b.id END) as lost,
                COALESCE(SUM(CASE WHEN b.status IN ({$going}) THEN p.subtotal ELSE 0 END), 0) as booked_value
            ")
            ->groupBy('s.id', 's.name', 's.district')->orderByDesc('bookings')->get()
            ->map(fn ($r) => [
                'shop' => $r->shop,
                'district' => $r->district,
                'bookings' => (int) $r->bookings,
                'going_ahead' => (int) $r->going_ahead,
                'completed' => (int) $r->completed,
                'pending' => (int) $r->pending,
                'lost' => (int) $r->lost,
                'lost_rate' => $r->bookings ? round($r->lost / $r->bookings * 100, 1) : 0,
                'booked_value' => (float) $r->booked_value,
            ]);
        $total = $rows->sum('bookings');

        return [
            'note' => 'Lost means rejected, expired, cancelled or a no-show. Booked value is money between customers and shops; the platform does not receive it.',
            'summary' => [
                R::tile('Bookings', $total),
                R::tile('Going ahead', $rows->sum('going_ahead')),
                R::tile('Lost', $total ? round($rows->sum('lost') / $total * 100, 1) : 0, 'percent'),
                R::tile('Booked value', $rows->sum('booked_value'), 'money'),
            ],
            'columns' => [
                R::col('shop', 'Shop'), R::col('district', 'District'), R::col('bookings', 'Bookings', 'number'),
                R::col('going_ahead', 'Going ahead', 'number'), R::col('completed', 'Completed', 'number'), R::col('pending', 'Pending', 'number'),
                R::col('lost', 'Lost', 'number'), R::col('lost_rate', 'Lost rate', 'percent'), R::col('booked_value', 'Booked value', 'money'),
            ],
            'rows' => $rows->all(),
        ];
    }

    public function customers(Carbon $from, Carbon $to): array
    {
        $bookings = DB::table('bookings')->whereNull('deleted_at')->selectRaw('customer_id, COUNT(*) as total')->groupBy('customer_id')->pluck('total', 'customer_id');

        $rows = DB::table('customers')->whereNull('deleted_at')->whereBetween('created_at', [$from, $to])->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'phone', 'status', 'registration_source', 'last_login_at', 'created_at'])
            ->map(fn ($c) => [
                'name' => $c->name,
                'email' => $c->email,
                'phone' => $c->phone,
                'status' => $c->status,
                'joined_from' => self::words($c->registration_source),
                'bookings' => (int) ($bookings[$c->id] ?? 0),
                'last_login' => self::date($c->last_login_at),
                'joined' => self::date($c->created_at),
            ]);

        return [
            'note' => 'Customers who joined in the period. Bookings is their all-time count.',
            'summary' => [
                R::tile('New customers', $rows->count()),
                R::tile('Have booked', $rows->where('bookings', '>', 0)->count()),
                R::tile('Never signed in again', $rows->whereNull('last_login')->count()),
                R::tile('Suspended or banned', $rows->where('status', '!=', 'active')->count()),
            ],
            'columns' => [
                R::col('name', 'Name'), R::col('email', 'Email'), R::col('phone', 'Phone'), R::col('status', 'Status', 'status'),
                R::col('joined_from', 'Joined from'), R::col('bookings', 'Bookings', 'number'),
                R::col('last_login', 'Last sign-in', 'date'), R::col('joined', 'Joined', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Per shop: cars for sale today, and enquiries and recorded sales in the period. */
    public function vehicleSales(Carbon $from, Carbon $to): array
    {
        $forSale = DB::table('vehicle_sale_details as d')->join('vehicles as v', 'v.id', '=', 'd.vehicle_id')
            ->whereNull('v.deleted_at')->where('v.status', Vehicle::STATUS_PUBLISHED)->where('d.sale_status', VehicleSaleDetail::STATUS_AVAILABLE)
            ->selectRaw('d.shop_id, COUNT(*) as total')->groupBy('d.shop_id')->pluck('total', 'shop_id');
        $enquiries = DB::table('sale_enquiries')->whereBetween('created_at', [$from, $to])
            ->selectRaw('shop_id, COUNT(*) as total')->groupBy('shop_id')->pluck('total', 'shop_id');
        $sold = DB::table('vehicle_sales')->whereBetween('sold_at', [$from, $to])
            ->selectRaw('shop_id, COUNT(*) as total, SUM(sale_price) as value')->groupBy('shop_id')->get()->keyBy('shop_id');

        $ids = $forSale->keys()->merge($enquiries->keys())->merge($sold->keys())->unique();
        $shops = DB::table('rental_shops')->whereIn('id', $ids)->get(['id', 'name', 'district'])->keyBy('id');

        $rows = $ids->map(fn ($id) => [
            'shop' => $shops[$id]->name ?? '—',
            'district' => $shops[$id]->district ?? null,
            'for_sale' => (int) ($forSale[$id] ?? 0),
            'enquiries' => (int) ($enquiries[$id] ?? 0),
            'sold' => (int) ($sold[$id]->total ?? 0),
            'sold_value' => (float) ($sold[$id]->value ?? 0),
        ])->sortByDesc('sold_value')->values();

        return [
            'note' => 'For sale now is today\'s figure. Sales are recorded by shops and paid at the shop, not through the platform.',
            'summary' => [
                R::tile('For sale now', $rows->sum('for_sale')),
                R::tile('Enquiries', $rows->sum('enquiries')),
                R::tile('Sold', $rows->sum('sold')),
                R::tile('Value recorded', $rows->sum('sold_value'), 'money'),
            ],
            'columns' => [
                R::col('shop', 'Shop'), R::col('district', 'District'), R::col('for_sale', 'For sale now', 'number'),
                R::col('enquiries', 'Enquiries', 'number'), R::col('sold', 'Sold', 'number'), R::col('sold_value', 'Sold value', 'money'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /* ─── Trust and safety ────────────────────────────────────────────── */

    public function disputes(Carbon $from, Carbon $to): array
    {
        $rows = DB::table('disputes as d')->leftJoin('bookings as b', 'b.id', '=', 'd.booking_id')->leftJoin('rental_shops as s', 's.id', '=', 'b.shop_id')
            ->whereBetween('d.created_at', [$from, $to])->orderByDesc('d.created_at')
            ->get(['d.dispute_reference', 'd.category', 'd.raised_by_side', 'd.status', 'd.priority', 'd.claimed_amount', 'd.resolution_amount', 'd.resolution_in_favour_of', 'd.resolved_at', 'd.created_at', 'b.booking_reference', 's.name as shop'])
            ->map(fn ($d) => [
                'raised' => self::date($d->created_at),
                'reference' => $d->dispute_reference,
                'booking' => $d->booking_reference,
                'shop' => $d->shop,
                'category' => self::words($d->category),
                'raised_by' => self::words($d->raised_by_side),
                'status' => $d->status,
                'claimed' => (float) ($d->claimed_amount ?? 0),
                'awarded' => (float) ($d->resolution_amount ?? 0),
                'in_favour_of' => self::words($d->resolution_in_favour_of),
                'resolved' => self::date($d->resolved_at),
                'days' => $d->resolved_at ? (int) Carbon::parse($d->created_at)->startOfDay()->diffInDays(Carbon::parse($d->resolved_at)->startOfDay()) : null,
            ]);
        $resolved = $rows->whereNotNull('days');

        return [
            'summary' => [
                R::tile('Disputes', $rows->count()),
                R::tile('Still open', $rows->whereNotIn('status', [Dispute::STATUS_RESOLVED, Dispute::STATUS_CLOSED])->count()),
                R::tile('Average days to resolve', $resolved->isEmpty() ? 0 : round($resolved->avg('days'), 1)),
                R::tile('Amount claimed', $rows->sum('claimed'), 'money'),
            ],
            'columns' => [
                R::col('raised', 'Raised', 'date'), R::col('reference', 'Reference'), R::col('booking', 'Booking'), R::col('shop', 'Shop'),
                R::col('category', 'Category'), R::col('raised_by', 'Raised by'), R::col('status', 'Status', 'status'),
                R::col('claimed', 'Claimed', 'money'), R::col('awarded', 'Awarded', 'money'), R::col('in_favour_of', 'In favour of'),
                R::col('resolved', 'Resolved', 'date'), R::col('days', 'Days', 'number'),
            ],
            'rows' => $rows->all(),
        ];
    }

    public function abuseReports(Carbon $from, Carbon $to): array
    {
        $rows = DB::table('reports as r')->leftJoin('system_admins as a', 'a.id', '=', 'r.reviewed_by')
            ->whereBetween('r.created_at', [$from, $to])->orderByDesc('r.created_at')
            ->get(['r.reportable_type', 'r.reportable_id', 'r.reason', 'r.status', 'r.action_taken', 'r.reviewed_at', 'r.created_at', 'a.name as reviewer'])
            ->map(fn ($r) => [
                'reported' => self::date($r->created_at),
                'against' => class_basename((string) $r->reportable_type) . ' #' . $r->reportable_id,
                'kind' => class_basename((string) $r->reportable_type),
                'reason' => self::words($r->reason),
                'status' => $r->status,
                'action' => self::words($r->action_taken),
                'handled_by' => $r->reviewer,
                'handled' => self::date($r->reviewed_at),
            ]);

        return [
            'summary' => [
                R::tile('Reports', $rows->count()),
                R::tile('Waiting', $rows->whereIn('status', [Report::STATUS_NEW, Report::STATUS_REVIEWING])->count()),
                R::tile('Action taken', $rows->where('status', Report::STATUS_ACTIONED)->count()),
                R::tile('Dismissed', $rows->where('status', Report::STATUS_DISMISSED)->count()),
            ],
            'columns' => [
                R::col('reported', 'Reported', 'date'), R::col('against', 'Against'), R::col('kind', 'Kind'), R::col('reason', 'Reason'),
                R::col('status', 'Status', 'status'), R::col('action', 'Action taken'), R::col('handled_by', 'Handled by'), R::col('handled', 'Handled', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Per shop, by the day the review was written. */
    public function reviews(Carbon $from, Carbon $to): array
    {
        $rows = DB::table('reviews as r')->join('rental_shops as s', 's.id', '=', 'r.shop_id')
            ->whereBetween('r.created_at', [$from, $to])
            ->selectRaw("
                s.name as shop, s.district, COUNT(*) as reviews, AVG(r.rating) as average,
                SUM(r.status = ?) as published, SUM(r.status = ?) as pending,
                SUM(r.status = ?) as rejected, SUM(r.status = ?) as hidden, SUM(r.rating <= 2) as low
            ", [Review::STATUS_PUBLISHED, Review::STATUS_PENDING, Review::STATUS_REJECTED, Review::STATUS_HIDDEN])
            ->groupBy('s.id', 's.name', 's.district')->orderByDesc('reviews')->get()
            ->map(fn ($r) => [
                'shop' => $r->shop,
                'district' => $r->district,
                'reviews' => (int) $r->reviews,
                'average' => round((float) $r->average, 2),
                'low' => (int) $r->low,
                'published' => (int) $r->published,
                'pending' => (int) $r->pending,
                'rejected' => (int) $r->rejected,
                'hidden' => (int) $r->hidden,
            ]);
        $total = $rows->sum('reviews');

        return [
            'note' => 'Low ratings are 1 or 2 stars.',
            'summary' => [
                R::tile('Reviews', $total),
                R::tile('Average rating', $total ? round($rows->sum(fn ($r) => $r['average'] * $r['reviews']) / $total, 2) : 0),
                R::tile('Waiting to be moderated', $rows->sum('pending')),
                R::tile('Rejected or hidden', $rows->sum('rejected') + $rows->sum('hidden')),
            ],
            'columns' => [
                R::col('shop', 'Shop'), R::col('district', 'District'), R::col('reviews', 'Reviews', 'number'), R::col('average', 'Average rating', 'number'),
                R::col('low', 'Low ratings', 'number'), R::col('published', 'Published', 'number'), R::col('pending', 'Pending', 'number'),
                R::col('rejected', 'Rejected', 'number'), R::col('hidden', 'Hidden', 'number'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /* ─── System ──────────────────────────────────────────────────────── */

    public function siteVisits(Carbon $from, Carbon $to): array
    {
        $rows = DB::table('public_visits')->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as day, SUM(type = ?) as public_visits, SUM(type = ?) as vendor_visits, COUNT(DISTINCT ip) as visitors', [PublicVisit::TYPE_PUBLIC, PublicVisit::TYPE_VENDOR])
            ->groupBy('day')->orderByDesc('day')->get()
            ->map(fn ($r) => [
                'day' => $r->day,
                'public_visits' => (int) $r->public_visits,
                'vendor_visits' => (int) $r->vendor_visits,
                'total' => (int) $r->public_visits + (int) $r->vendor_visits,
                'visitors' => (int) $r->visitors,
            ]);
        $visitors = (int) DB::table('public_visits')->whereBetween('created_at', [$from, $to])->distinct()->count('ip');

        return [
            'note' => 'Visitors are counted by IP address, so several people on one network count as one. Days with no visits are left out.',
            'summary' => [
                R::tile('Public site visits', $rows->sum('public_visits')),
                R::tile('Vendor app visits', $rows->sum('vendor_visits')),
                R::tile('Different visitors', $visitors),
                R::tile('Busiest day', $rows->max('total') ?? 0),
            ],
            'columns' => [
                R::col('day', 'Day', 'date'), R::col('public_visits', 'Public site', 'number'), R::col('vendor_visits', 'Vendor app', 'number'),
                R::col('total', 'Total', 'number'), R::col('visitors', 'Visitors', 'number'),
            ],
            'rows' => $rows->all(),
        ];
    }

    public function adminActivity(Carbon $from, Carbon $to): array
    {
        $query = DB::table('audit_logs as l')->join('system_admins as a', 'a.id', '=', 'l.system_admin_id')->whereBetween('l.created_at', [$from, $to]);
        $total = (clone $query)->count();
        $admins = (clone $query)->distinct()->count('l.system_admin_id');
        $busiest = (clone $query)->selectRaw('a.name, COUNT(*) as total')->groupBy('a.id', 'a.name')->orderByDesc('total')->first();

        $rows = $query->orderByDesc('l.created_at')->orderByDesc('l.id')->limit(self::ACTIVITY_LIMIT)
            ->get(['l.created_at', 'l.action', 'l.form', 'l.record', 'l.ip', 'a.name as admin', 'a.admin_role'])
            ->map(fn ($l) => [
                'when' => Carbon::parse($l->created_at)->format('Y-m-d H:i'),
                'admin' => $l->admin,
                'role' => self::words($l->admin_role),
                'action' => self::words($l->action),
                'what' => $l->form,
                'record' => $l->record,
                'ip' => $l->ip,
            ]);

        return [
            'note' => $total > self::ACTIVITY_LIMIT ? 'Showing the newest ' . number_format(self::ACTIVITY_LIMIT) . ' of ' . number_format($total) . ' actions. Pick a shorter period to see the rest.' : null,
            'summary' => [
                R::tile('Actions', $total),
                R::tile('Admins active', $admins),
                R::tile('Most active', $busiest->name ?? '—', 'text'),
                R::tile('Their actions', (int) ($busiest->total ?? 0)),
            ],
            'columns' => [
                R::col('when', 'When'), R::col('admin', 'Admin'), R::col('role', 'Role'), R::col('action', 'Action'),
                R::col('what', 'On'), R::col('record', 'Record'), R::col('ip', 'IP address'),
            ],
            'rows' => $rows->all(),
        ];
    }
}
