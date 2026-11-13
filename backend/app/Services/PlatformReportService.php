<?php

namespace App\Services;

use App\Models\PlatformExpense;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\SubscriptionPayment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The platform's reports — /platform/reports. Same shape as the vendor reports
 * (ShopReportService): summary tiles, columns and rows, so one page and one export serve
 * them all. Unlike those, every query here is platform-wide.
 *
 * The money and shop reports are built here; the marketplace, trust and system ones in
 * PlatformActivityReports. Column types: text, number, money, percent, date, status.
 */
class PlatformReportService
{
    public const GROUPS = [
        'money' => 'Platform money',
        'shops' => 'Shops and vendors',
        'marketplace' => 'Marketplace activity',
        'trust' => 'Trust and safety',
        'system' => 'System',
    ];

    /**
     * slug => what the catalogue page shows. `owner_only`: the platform's own money, Platform
     * Owner only (like /platform/accounts). `dated`: false when it shows today's position.
     */
    public const REPORTS = [
        'income-statement' => ['group' => 'money', 'title' => 'Income Statement', 'description' => 'Subscriptions, promotions, expenses and profit or loss, month by month.', 'owner_only' => true, 'dated' => true],
        'subscription-payments' => ['group' => 'money', 'title' => 'Subscription Payments', 'description' => 'Every plan payment shops sent, with its status and who checked it.', 'owner_only' => true, 'dated' => true],
        'promotion-sales' => ['group' => 'money', 'title' => 'Promotion Sales', 'description' => 'Every paid featured listing and shop sponsorship.', 'owner_only' => true, 'dated' => true],
        'platform-expenses' => ['group' => 'money', 'title' => 'Platform Expenses', 'description' => 'What the platform spent, by category and who was paid.', 'owner_only' => true, 'dated' => true],
        'income-by-shop' => ['group' => 'money', 'title' => 'Income by Shop', 'description' => 'What each shop paid the platform, biggest first.', 'owner_only' => true, 'dated' => true],
        'renewals-due' => ['group' => 'money', 'title' => 'Renewals Due', 'description' => 'Shops whose plan or trial ends within 30 days, is in grace, or has lapsed.', 'owner_only' => true, 'dated' => false],

        'shop-register' => ['group' => 'shops', 'title' => 'Shop Register', 'description' => 'Every shop with its owner, location, status, plan and vehicle count.', 'owner_only' => false, 'dated' => false],
        'shop-signups' => ['group' => 'shops', 'title' => 'Shop Sign-ups', 'description' => 'Shops registered, verified and published, month by month.', 'owner_only' => false, 'dated' => true],
        'verification-turnaround' => ['group' => 'shops', 'title' => 'Verification Turnaround', 'description' => 'How long each new shop waited to be verified, and the ones rejected or suspended.', 'owner_only' => false, 'dated' => true],
        'vendor-accounts' => ['group' => 'shops', 'title' => 'Vendor Accounts', 'description' => 'Shop owners and staff, with their account status and last sign-in.', 'owner_only' => false, 'dated' => false],
        'inactive-shops' => ['group' => 'shops', 'title' => 'Inactive Shops', 'description' => 'Verified shops with no live vehicles, or no bookings in the period.', 'owner_only' => false, 'dated' => true],

        'vehicle-listings' => ['group' => 'marketplace', 'title' => 'Vehicle Listings', 'description' => 'Every vehicle with its shop, category, status and views.', 'owner_only' => false, 'dated' => false],
        'bookings-summary' => ['group' => 'marketplace', 'title' => 'Bookings Summary', 'description' => 'Bookings, cancellations and booked value per shop.', 'owner_only' => false, 'dated' => true],
        'customers' => ['group' => 'marketplace', 'title' => 'Customers', 'description' => 'Customers who joined in the period, with their bookings and account status.', 'owner_only' => false, 'dated' => true],
        'vehicle-sales' => ['group' => 'marketplace', 'title' => 'Vehicle Sales', 'description' => 'Cars for sale, enquiries and recorded sales per shop.', 'owner_only' => false, 'dated' => true],

        'disputes' => ['group' => 'trust', 'title' => 'Disputes', 'description' => 'Disputes raised in the period, with their outcome and how long they took.', 'owner_only' => false, 'dated' => true],
        'abuse-reports' => ['group' => 'trust', 'title' => 'Abuse Reports', 'description' => 'Reports against vehicles, shops, reviews and users, and what was done.', 'owner_only' => false, 'dated' => true],
        'reviews' => ['group' => 'trust', 'title' => 'Reviews', 'description' => 'Reviews and average rating per shop, and how many were rejected or hidden.', 'owner_only' => false, 'dated' => true],

        'site-visits' => ['group' => 'system', 'title' => 'Site Visits', 'description' => 'Visits to the public site and the vendor app, day by day.', 'owner_only' => false, 'dated' => true],
        'admin-activity' => ['group' => 'system', 'title' => 'Admin Activity', 'description' => 'What each platform admin did, from the audit log.', 'owner_only' => false, 'dated' => true],
    ];

    public function __construct(private PlatformActivityReports $activity, private SubscriptionService $subscriptions) {}

    /** @return array{title: string, description: string, note: ?string, summary: array, columns: array, rows: array} */
    public function build(string $report, Carbon $from, Carbon $to): array
    {
        $data = match ($report) {
            'income-statement' => $this->incomeStatement($from, $to),
            'subscription-payments' => $this->subscriptionPayments($from, $to),
            'promotion-sales' => $this->promotionSales($from, $to),
            'platform-expenses' => $this->platformExpenses($from, $to),
            'income-by-shop' => $this->incomeByShop($from, $to),
            'renewals-due' => $this->renewalsDue(),
            'shop-register' => $this->shopRegister(),
            'shop-signups' => $this->shopSignups($from, $to),
            'verification-turnaround' => $this->verificationTurnaround($from, $to),
            'vendor-accounts' => $this->vendorAccounts(),
            'inactive-shops' => $this->inactiveShops($from, $to),
            'vehicle-listings' => $this->activity->vehicleListings(),
            'bookings-summary' => $this->activity->bookingsSummary($from, $to),
            'customers' => $this->activity->customers($from, $to),
            'vehicle-sales' => $this->activity->vehicleSales($from, $to),
            'disputes' => $this->activity->disputes($from, $to),
            'abuse-reports' => $this->activity->abuseReports($from, $to),
            'reviews' => $this->activity->reviews($from, $to),
            'site-visits' => $this->activity->siteVisits($from, $to),
            'admin-activity' => $this->activity->adminActivity($from, $to),
        };

        return ['title' => self::REPORTS[$report]['title'], 'description' => self::REPORTS[$report]['description']] + $data + ['note' => null];
    }

    public static function col(string $key, string $label, string $type = 'text'): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type];
    }

    public static function tile(string $label, $value, string $type = 'number'): array
    {
        return ['label' => $label, 'value' => $value, 'type' => $type];
    }

    /** "2026-11" => "Nov 2026". */
    public static function monthLabel(string $month): string
    {
        return Carbon::createFromFormat('Y-m-d', "{$month}-01")->format('M Y');
    }

    /** Every calendar month the period touches, oldest first, as "Y-m". */
    public static function months(Carbon $from, Carbon $to): array
    {
        $months = [];
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonth()) {
            $months[] = $m->format('Y-m');
        }

        return $months;
    }

    private function approvedSubscriptions(Carbon $from, Carbon $to)
    {
        return DB::table('subscription_payments')->where('status', SubscriptionPayment::STATUS_APPROVED)->whereBetween('reviewed_at', [$from, $to]);
    }

    private function approvedPromotions(Carbon $from, Carbon $to)
    {
        return DB::table('promotions')->where('status', Promotion::STATUS_APPROVED)->where('kind', Promotion::KIND_PAID)->whereBetween('reviewed_at', [$from, $to]);
    }

    /* ─── Platform money ──────────────────────────────────────────────── */

    private function incomeStatement(Carbon $from, Carbon $to): array
    {
        $byMonth = fn($query, string $column, string $amount) => $query
            ->selectRaw("DATE_FORMAT({$column}, '%Y-%m') as month, SUM({$amount}) as total")->groupBy('month')->pluck('total', 'month');

        $subscriptions = $byMonth($this->approvedSubscriptions($from, $to), 'reviewed_at', 'amount');
        $promotions = $byMonth($this->approvedPromotions($from, $to), 'reviewed_at', 'amount');
        $expenses = $byMonth(
            DB::table('platform_expenses')->whereNull('deleted_at')->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()]),
            'expense_date',
            'amount'
        );

        $rows = collect(self::months($from, $to))->map(function (string $month) use ($subscriptions, $promotions, $expenses) {
            $in = (float) ($subscriptions[$month] ?? 0) + (float) ($promotions[$month] ?? 0);
            $out = (float) ($expenses[$month] ?? 0);

            return [
                'month' => self::monthLabel($month),
                'subscriptions' => (float) ($subscriptions[$month] ?? 0),
                'promotions' => (float) ($promotions[$month] ?? 0),
                'income' => $in,
                'expenses' => $out,
                'net' => $in - $out,
            ];
        });

        return [
            'note' => 'Money in is counted in the month a payment was approved; expenses in the month of their date. Booking money is not included: customers pay shops directly.',
            'summary' => [
                self::tile('Subscriptions', $rows->sum('subscriptions'), 'money'),
                self::tile('Promotions', $rows->sum('promotions'), 'money'),
                self::tile('Expenses', $rows->sum('expenses'), 'money'),
                self::tile('Profit / loss', $rows->sum('net'), 'money'),
            ],
            'columns' => [
                self::col('month', 'Month'),
                self::col('subscriptions', 'Subscriptions', 'money'),
                self::col('promotions', 'Promotions', 'money'),
                self::col('income', 'Money in', 'money'),
                self::col('expenses', 'Expenses', 'money'),
                self::col('net', 'Profit / loss', 'money'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /** By the day the shop sent the payment, in any status. */
    private function subscriptionPayments(Carbon $from, Carbon $to): array
    {
        $payments = SubscriptionPayment::with(['shop:id,name', 'plan:id,name', 'reviewer:id,name'])
            ->whereBetween('created_at', [$from, $to])->orderByDesc('created_at')->get();
        $of = fn(string $status) => $payments->where('status', $status);

        return [
            'note' => 'Listed by the day the shop sent the payment. Only approved payments count as income.',
            'summary' => [
                self::tile('Payments', $payments->count()),
                self::tile('Approved', $of(SubscriptionPayment::STATUS_APPROVED)->sum(fn($p) => (float) $p->amount), 'money'),
                self::tile('Waiting to be checked', $of(SubscriptionPayment::STATUS_PENDING)->sum(fn($p) => (float) $p->amount), 'money'),
                self::tile('Rejected', $of(SubscriptionPayment::STATUS_REJECTED)->count()),
            ],
            'columns' => [
                self::col('sent', 'Sent', 'date'),
                self::col('reference', 'Reference'),
                self::col('shop', 'Shop'),
                self::col('plan', 'Plan'),
                self::col('periods', 'Periods', 'number'),
                self::col('amount', 'Amount', 'money'),
                self::col('status', 'Status', 'status'),
                self::col('bank_reference', 'Bank reference'),
                self::col('checked_by', 'Checked by'),
                self::col('checked_at', 'Checked', 'date'),
            ],
            'rows' => $payments->map(fn(SubscriptionPayment $p) => [
                'sent' => $p->created_at?->toDateString(),
                'reference' => $p->reference_no,
                'shop' => $p->shop?->name,
                'plan' => $p->plan?->name,
                'periods' => (int) $p->periods,
                'amount' => (float) $p->amount,
                'status' => $p->status,
                'bank_reference' => $p->bank_reference,
                'checked_by' => $p->reviewer?->name,
                'checked_at' => $p->reviewed_at?->toDateString(),
            ])->all(),
        ];
    }

    /** Paid promotions only (a free grant is not a sale), by the day the shop asked. */
    private function promotionSales(Carbon $from, Carbon $to): array
    {
        $promotions = Promotion::with(['shop:id,name', 'vehicle:id,title', 'reviewer:id,name'])
            ->where('kind', Promotion::KIND_PAID)->whereBetween('created_at', [$from, $to])->orderByDesc('created_at')->get();
        $approved = $promotions->where('status', Promotion::STATUS_APPROVED);

        return [
            'note' => 'Promotions the platform gave for free are left out. Only approved ones count as income.',
            'summary' => [
                self::tile('Requests', $promotions->count()),
                self::tile('Approved', $approved->sum(fn($p) => (float) $p->amount), 'money'),
                self::tile('Featured vehicles', $approved->where('type', Promotion::TYPE_FEATURED)->sum(fn($p) => (float) $p->amount), 'money'),
                self::tile('Sponsored shops', $approved->where('type', Promotion::TYPE_SPONSORED)->sum(fn($p) => (float) $p->amount), 'money'),
            ],
            'columns' => [
                self::col('sent', 'Sent', 'date'),
                self::col('reference', 'Reference'),
                self::col('shop', 'Shop'),
                self::col('type', 'Type'),
                self::col('target', 'For'),
                self::col('days', 'Days', 'number'),
                self::col('amount', 'Amount', 'money'),
                self::col('status', 'Status', 'status'),
                self::col('starts_at', 'Starts', 'date'),
                self::col('ends_at', 'Ends', 'date'),
            ],
            'rows' => $promotions->map(fn(Promotion $p) => [
                'sent' => $p->created_at?->toDateString(),
                'reference' => $p->reference_no,
                'shop' => $p->shop?->name,
                'type' => $p->type === Promotion::TYPE_FEATURED ? 'Featured vehicle' : 'Sponsored shop',
                'target' => $p->targetLabel(),
                'days' => (int) $p->days,
                'amount' => (float) $p->amount,
                'status' => $p->state(),
                'starts_at' => $p->starts_at?->toDateString(),
                'ends_at' => $p->ends_at?->toDateString(),
            ])->all(),
        ];
    }

    private function platformExpenses(Carbon $from, Carbon $to): array
    {
        $expenses = PlatformExpense::with('createdBy:id,name')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])->orderByDesc('expense_date')->orderByDesc('id')->get();
        $label = fn(?string $value) => ucwords(str_replace('_', ' ', (string) $value));
        $biggest = $expenses->groupBy('category')->map(fn($group) => $group->sum(fn($e) => (float) $e->amount))->sortDesc();

        return [
            'summary' => [
                self::tile('Expenses', $expenses->count()),
                self::tile('Total spent', $expenses->sum(fn($e) => (float) $e->amount), 'money'),
                self::tile('Biggest category', $biggest->isEmpty() ? '—' : $label($biggest->keys()->first()), 'text'),
                self::tile('Spent on it', (float) ($biggest->first() ?? 0), 'money'),
            ],
            'columns' => [
                self::col('date', 'Date', 'date'),
                self::col('number', 'Number'),
                self::col('category', 'Category'),
                self::col('paid_to', 'Paid to'),
                self::col('description', 'Description'),
                self::col('method', 'Paid by'),
                self::col('reference_no', 'Reference no.'),
                self::col('amount', 'Amount', 'money'),
                self::col('recorded_by', 'Recorded by'),
            ],
            'rows' => $expenses->map(fn(PlatformExpense $e) => [
                'date' => $e->expense_date?->toDateString(),
                'number' => $e->expense_number,
                'category' => $label($e->category),
                'paid_to' => $e->paid_to,
                'description' => $e->description,
                'method' => $e->payment_method ? $label($e->payment_method) : null,
                'reference_no' => $e->reference_no,
                'amount' => (float) $e->amount,
                'recorded_by' => $e->createdBy?->name,
            ])->all(),
        ];
    }

    private function incomeByShop(Carbon $from, Carbon $to): array
    {
        $perShop = fn($query) => $query->selectRaw('shop_id, COUNT(*) as payments, SUM(amount) as total, MAX(reviewed_at) as last_paid')->groupBy('shop_id')->get()->keyBy('shop_id');
        $subscriptions = $perShop($this->approvedSubscriptions($from, $to));
        $promotions = $perShop($this->approvedPromotions($from, $to));

        $ids = $subscriptions->keys()->merge($promotions->keys())->unique();
        $shops = DB::table('rental_shops')->whereIn('id', $ids)->get(['id', 'name', 'district'])->keyBy('id');

        $rows = $ids->map(function ($id) use ($subscriptions, $promotions, $shops) {
            $sub = (float) ($subscriptions[$id]->total ?? 0);
            $promo = (float) ($promotions[$id]->total ?? 0);
            $last = collect([$subscriptions[$id]->last_paid ?? null, $promotions[$id]->last_paid ?? null])->filter()->max();

            return [
                'shop' => $shops[$id]->name ?? '—',
                'district' => $shops[$id]->district ?? null,
                'payments' => (int) ($subscriptions[$id]->payments ?? 0) + (int) ($promotions[$id]->payments ?? 0),
                'subscriptions' => $sub,
                'promotions' => $promo,
                'total' => $sub + $promo,
                'last_paid' => $last ? Carbon::parse($last)->toDateString() : null,
            ];
        })->sortByDesc('total')->values();

        return [
            'note' => 'Approved payments only, by the day they were approved.',
            'summary' => [
                self::tile('Shops that paid', $rows->count()),
                self::tile('Subscriptions', $rows->sum('subscriptions'), 'money'),
                self::tile('Promotions', $rows->sum('promotions'), 'money'),
                self::tile('Total', $rows->sum('total'), 'money'),
            ],
            'columns' => [
                self::col('shop', 'Shop'),
                self::col('district', 'District'),
                self::col('payments', 'Payments', 'number'),
                self::col('subscriptions', 'Subscriptions', 'money'),
                self::col('promotions', 'Promotions', 'money'),
                self::col('total', 'Total', 'money'),
                self::col('last_paid', 'Last paid', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Today's position: every verified shop that needs chasing soon, soonest first. */
    private function renewalsDue(): array
    {
        $soon = now()->addDays(30);
        $rows = RentalShop::where('verification_status', RentalShop::VERIFICATION_VERIFIED)->get(['id', 'name', 'phone', 'district'])
            ->map(function (RentalShop $shop) use ($soon) {
                $current = $this->subscriptions->current($shop->id);
                $ends = $current['state'] === 'grace' ? $current['grace_ends_at'] : $current['ends_at'];
                if (in_array($current['state'], ['trial', 'active'], true) && $ends && $ends->gt($soon)) {
                    return null; // nothing to do for a month
                }

                return [
                    'shop' => $shop->name,
                    'phone' => $shop->phone,
                    'district' => $shop->district,
                    'plan' => $current['plan']->name,
                    'state' => match ($current['state']) {
                        'trial' => 'trial',
                        'active' => 'active',
                        'grace' => 'in_grace',
                        default => 'unpaid',
                    },
                    'ends' => $ends?->toDateString(),
                    'days_left' => $ends ? (int) floor(now()->startOfDay()->diffInDays($ends->copy()->startOfDay(), false)) : null,
                ];
            })->filter()->sortBy(fn($r) => $r['days_left'] ?? -1)->values();

        return [
            'note' => 'Shows today\'s position. In grace: the plan has ended but still works until the date shown. Unpaid: the shop\'s vendor workspace is locked.',
            'summary' => [
                self::tile('Ending in 7 days', $rows->whereIn('state', ['trial', 'active'])->where('days_left', '<=', 7)->count()),
                self::tile('Ending in 30 days', $rows->whereIn('state', ['trial', 'active'])->count()),
                self::tile('In grace', $rows->where('state', 'in_grace')->count()),
                self::tile('Unpaid (locked)', $rows->where('state', 'unpaid')->count()),
            ],
            'columns' => [
                self::col('shop', 'Shop'),
                self::col('phone', 'Phone'),
                self::col('district', 'District'),
                self::col('plan', 'Plan'),
                self::col('state', 'State', 'status'),
                self::col('ends', 'Ends', 'date'),
                self::col('days_left', 'Days left', 'number'),
            ],
            'rows' => $rows->all(),
        ];
    }

    /* ─── Shops and vendors ───────────────────────────────────────────── */

    private function shopRegister(): array
    {
        $vehicles = DB::table('vehicles')->whereNull('deleted_at')->selectRaw('shop_id, COUNT(*) as total')->groupBy('shop_id')->pluck('total', 'shop_id');

        $rows = DB::table('rental_shops as s')->leftJoin('users as u', 'u.id', '=', 's.owner_user_id')->whereNull('s.deleted_at')
            ->orderBy('s.name')
            ->get(['s.id', 's.name', 's.phone', 's.city', 's.district', 's.status', 's.verification_status', 's.is_published', 's.created_at', 'u.name as owner', 'u.email as owner_email'])
            ->map(fn($s) => [
                'shop' => $s->name,
                'owner' => $s->owner,
                'owner_email' => $s->owner_email,
                'phone' => $s->phone,
                'district' => $s->district,
                'city' => $s->city,
                'status' => $s->status,
                'verification' => $s->verification_status,
                'published' => $s->is_published ? 'Yes' : 'No',
                'plan' => $s->verification_status === RentalShop::VERIFICATION_VERIFIED ? $this->subscriptions->current((int) $s->id)['plan']->name : null,
                'vehicles' => (int) ($vehicles[$s->id] ?? 0),
                'registered' => Carbon::parse($s->created_at)->toDateString(),
            ]);

        return [
            'summary' => [
                self::tile('Shops', $rows->count()),
                self::tile('Verified', $rows->where('verification', RentalShop::VERIFICATION_VERIFIED)->count()),
                self::tile('Live on the site', $rows->where('published', 'Yes')->count()),
                self::tile('Vehicles', $rows->sum('vehicles')),
            ],
            'columns' => [
                self::col('shop', 'Shop'),
                self::col('owner', 'Owner'),
                self::col('owner_email', 'Owner email'),
                self::col('phone', 'Phone'),
                self::col('district', 'District'),
                self::col('city', 'City'),
                self::col('status', 'Status', 'status'),
                self::col('verification', 'Verification', 'status'),
                self::col('published', 'Published'),
                self::col('plan', 'Plan'),
                self::col('vehicles', 'Vehicles', 'number'),
                self::col('registered', 'Registered', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    private function shopSignups(Carbon $from, Carbon $to): array
    {
        $byMonth = fn(string $column) => DB::table('rental_shops')->whereNull('deleted_at')->whereBetween($column, [$from, $to])
            ->selectRaw("DATE_FORMAT({$column}, '%Y-%m') as month, COUNT(*) as total")->groupBy('month')->pluck('total', 'month');

        $registered = $byMonth('created_at');
        $verified = $byMonth('verified_at');
        $published = $byMonth('published_at');

        $rows = collect(self::months($from, $to))->map(fn(string $month) => [
            'month' => self::monthLabel($month),
            'registered' => (int) ($registered[$month] ?? 0),
            'verified' => (int) ($verified[$month] ?? 0),
            'published' => (int) ($published[$month] ?? 0),
        ]);

        return [
            'note' => 'Each column counts shops by when that step happened, so a shop registered in one month can be verified in the next.',
            'summary' => [
                self::tile('Registered', $rows->sum('registered')),
                self::tile('Verified', $rows->sum('verified')),
                self::tile('Published', $rows->sum('published')),
            ],
            'columns' => [
                self::col('month', 'Month'),
                self::col('registered', 'Registered', 'number'),
                self::col('verified', 'Verified', 'number'),
                self::col('published', 'Published', 'number'),
            ],
            'rows' => $rows->all(),
        ];
    }

    private function verificationTurnaround(Carbon $from, Carbon $to): array
    {
        $rows = DB::table('rental_shops')->whereNull('deleted_at')->whereBetween('created_at', [$from, $to])->orderByDesc('created_at')
            ->get(['name', 'district', 'status', 'verification_status', 'verified_at', 'suspended_reason', 'created_at'])
            ->map(fn($s) => [
                'shop' => $s->name,
                'district' => $s->district,
                'registered' => Carbon::parse($s->created_at)->toDateString(),
                'verification' => $s->verification_status,
                'verified' => $s->verified_at ? Carbon::parse($s->verified_at)->toDateString() : null,
                'days' => $s->verified_at ? (int) Carbon::parse($s->created_at)->startOfDay()->diffInDays(Carbon::parse($s->verified_at)->startOfDay()) : null,
                'status' => $s->status,
                'reason' => $s->suspended_reason,
            ]);
        $verified = $rows->whereNotNull('days');

        return [
            'note' => 'Shops registered in the period. Days is from registration to verification.',
            'summary' => [
                self::tile('Registered', $rows->count()),
                self::tile('Verified', $verified->count()),
                self::tile('Average days to verify', $verified->isEmpty() ? 0 : round($verified->avg('days'), 1)),
                self::tile('Still waiting', $rows->whereIn('verification', ['unverified', 'pending'])->count()),
            ],
            'columns' => [
                self::col('shop', 'Shop'),
                self::col('district', 'District'),
                self::col('registered', 'Registered', 'date'),
                self::col('verification', 'Verification', 'status'),
                self::col('verified', 'Verified', 'date'),
                self::col('days', 'Days', 'number'),
                self::col('status', 'Shop status', 'status'),
                self::col('reason', 'Reason given'),
            ],
            'rows' => $rows->all(),
        ];
    }

    private function vendorAccounts(): array
    {
        $rows = DB::table('users as u')->join('rental_shops as s', 's.id', '=', 'u.shop_id')->whereNull('u.deleted_at')
            ->orderBy('s.name')->orderByRaw('s.owner_user_id = u.id desc')->orderBy('u.name')
            ->get(['u.id', 'u.name', 'u.email', 'u.phone', 'u.status', 'u.last_login_at', 'u.created_at', 's.name as shop', 's.owner_user_id'])
            ->map(fn($u) => [
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'shop' => $u->shop,
                'role' => (int) $u->owner_user_id === (int) $u->id ? 'Owner' : 'Staff',
                'status' => $u->status,
                'last_login' => $u->last_login_at ? Carbon::parse($u->last_login_at)->toDateString() : null,
                'joined' => Carbon::parse($u->created_at)->toDateString(),
            ]);

        return [
            'summary' => [
                self::tile('Vendor accounts', $rows->count()),
                self::tile('Owners', $rows->where('role', 'Owner')->count()),
                self::tile('Staff', $rows->where('role', 'Staff')->count()),
                self::tile('Suspended or banned', $rows->where('status', '!=', 'active')->count()),
            ],
            'columns' => [
                self::col('name', 'Name'),
                self::col('email', 'Email'),
                self::col('phone', 'Phone'),
                self::col('shop', 'Shop'),
                self::col('role', 'Role'),
                self::col('status', 'Status', 'status'),
                self::col('last_login', 'Last sign-in', 'date'),
                self::col('joined', 'Joined', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }

    private function inactiveShops(Carbon $from, Carbon $to): array
    {
        $live = DB::table('vehicles')->whereNull('deleted_at')->where('status', 'published')
            ->selectRaw('shop_id, COUNT(*) as total')->groupBy('shop_id')->pluck('total', 'shop_id');
        $booked = DB::table('bookings')->whereNull('deleted_at')->whereBetween('created_at', [$from, $to])
            ->selectRaw('shop_id, COUNT(*) as total')->groupBy('shop_id')->pluck('total', 'shop_id');
        $lastBooking = DB::table('bookings')->whereNull('deleted_at')->selectRaw('shop_id, MAX(created_at) as last_at')->groupBy('shop_id')->pluck('last_at', 'shop_id');

        $rows = DB::table('rental_shops')->whereNull('deleted_at')->where('verification_status', RentalShop::VERIFICATION_VERIFIED)->orderBy('name')
            ->get(['id', 'name', 'phone', 'district', 'status', 'created_at'])
            ->map(function ($s) use ($live, $booked, $lastBooking) {
                $vehicles = (int) ($live[$s->id] ?? 0);
                $bookings = (int) ($booked[$s->id] ?? 0);
                if ($vehicles > 0 && $bookings > 0) {
                    return null;
                }

                return [
                    'shop' => $s->name,
                    'phone' => $s->phone,
                    'district' => $s->district,
                    'status' => $s->status,
                    'live_vehicles' => $vehicles,
                    'bookings' => $bookings,
                    'last_booking' => isset($lastBooking[$s->id]) ? Carbon::parse($lastBooking[$s->id])->toDateString() : null,
                    'why' => $vehicles === 0 ? 'No live vehicles' : 'No bookings in the period',
                    'registered' => Carbon::parse($s->created_at)->toDateString(),
                ];
            })->filter()->values();

        return [
            'note' => 'Verified shops only. Bookings are counted by the day they were made.',
            'summary' => [
                self::tile('Inactive shops', $rows->count()),
                self::tile('No live vehicles', $rows->where('live_vehicles', 0)->count()),
                self::tile('No bookings in the period', $rows->where('bookings', 0)->count()),
                self::tile('Never had a booking', $rows->whereNull('last_booking')->count()),
            ],
            'columns' => [
                self::col('shop', 'Shop'),
                self::col('phone', 'Phone'),
                self::col('district', 'District'),
                self::col('status', 'Status', 'status'),
                self::col('live_vehicles', 'Live vehicles', 'number'),
                self::col('bookings', 'Bookings', 'number'),
                self::col('last_booking', 'Last booking', 'date'),
                self::col('why', 'Why listed'),
                self::col('registered', 'Registered', 'date'),
            ],
            'rows' => $rows->all(),
        ];
    }
}
