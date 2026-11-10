<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingDamage;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Promotion;
use App\Models\Review;
use App\Models\SaleEnquiry;
use App\Models\SaleEnquiryMessage;
use App\Models\SecurityDeposit;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use App\Queries\ShopEarningsQuery;
use App\Support\VendorContext;
use Illuminate\Support\Carbon;

/**
 * The day-to-day reports, in the same shape as ShopReportService. Payment,
 * SecurityDeposit and BookingDamage have no shop of their own, so they reach
 * it through their booking, which is shop-scoped. Promotion and Review are
 * not scoped, so those two filter by shop_id.
 */
class ShopActivityReports
{
    private const LOST_STATUSES = [
        Booking::STATUS_REJECTED, Booking::STATUS_EXPIRED, Booking::STATUS_NO_SHOW,
        Booking::STATUS_CANCELLED_BY_CUSTOMER, Booking::STATUS_CANCELLED_BY_OWNER, Booking::STATUS_CANCELLED_BY_ADMIN,
    ];

    /** Money that changed hands, in or out, including deposits. Vehicle sales are paid outside the ledger. */
    public function payments(Carbon $from, Carbon $to): array
    {
        $rows = Payment::money()->where('status', Payment::STATUS_SUCCEEDED)
            ->whereHas('booking')
            ->whereRaw('COALESCE(paid_at, payments.created_at) BETWEEN ? AND ?', [$from, $to])
            ->with('booking:id,booking_reference,customer_id', 'booking.customer:id,name')
            ->get()
            ->sortByDesc(fn (Payment $p) => $p->paid_at ?? $p->created_at)
            ->map(fn (Payment $p) => [
                'date' => ($p->paid_at ?? $p->created_at)->toDateString(),
                'reference' => $p->booking?->booking_reference,
                'customer' => $p->booking?->customer?->name,
                'type' => ucwords(str_replace('_', ' ', $p->type)),
                'method' => $p->method === 'bank' ? 'Bank transfer' : 'Cash',
                'received' => (float) $p->credit,
                'paid_out' => (float) $p->debit,
            ])->values();

        return [
            'title' => 'Payments Received',
            'description' => 'Money that changed hands on bookings, for cashing up.',
            'note' => 'Includes security deposits taken and handed back. Vehicle sales are in the Vehicle Sales report.',
            'summary' => [
                ['label' => 'Received', 'value' => $rows->sum('received'), 'type' => 'money'],
                ['label' => 'Paid out', 'value' => $rows->sum('paid_out'), 'type' => 'money'],
                ['label' => 'Cash net', 'value' => $rows->where('method', 'Cash')->sum(fn ($r) => $r['received'] - $r['paid_out']), 'type' => 'money'],
                ['label' => 'Bank net', 'value' => $rows->where('method', 'Bank transfer')->sum(fn ($r) => $r['received'] - $r['paid_out']), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'type' => 'date'],
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'type', 'label' => 'For', 'type' => 'text'],
                ['key' => 'method', 'label' => 'Method', 'type' => 'text'],
                ['key' => 'received', 'label' => 'Received', 'type' => 'money'],
                ['key' => 'paid_out', 'label' => 'Paid out', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function deposits(Carbon $from, Carbon $to): array
    {
        $rows = SecurityDeposit::whereHas('booking', fn ($q) => $q->whereBetween('pickup_at', [$from, $to]))
            ->with('booking:id,booking_reference,customer_id,vehicle_id,pickup_at', 'booking.customer:id,name', 'booking.vehicle:id,title')
            ->get()
            ->map(function (SecurityDeposit $d) {
                $collected = (float) $d->amount_collected;
                $kept = (float) $d->deductions_amount;
                $settled = $d->released_at !== null;

                return [
                    'reference' => $d->booking?->booking_reference,
                    'customer' => $d->booking?->customer?->name,
                    'vehicle' => $d->booking?->vehicle?->title,
                    'pickup_at' => $d->booking?->pickup_at?->toDateString(),
                    'status' => $d->status,
                    'required' => (float) $d->amount_required,
                    'collected' => $collected,
                    'kept' => $kept,
                    'returned' => $settled ? max(0, $collected - $kept) : 0.0,
                    'held' => $settled ? 0.0 : $collected,
                ];
            })->sortByDesc('pickup_at')->values();

        return [
            'title' => 'Security Deposits',
            'description' => 'Deposits taken, returned and kept for damage, by pickup date.',
            'note' => null,
            'summary' => [
                ['label' => 'Collected', 'value' => $rows->sum('collected'), 'type' => 'money'],
                ['label' => 'Still held', 'value' => $rows->sum('held'), 'type' => 'money'],
                ['label' => 'Returned', 'value' => $rows->sum('returned'), 'type' => 'money'],
                ['label' => 'Kept for damage', 'value' => $rows->sum('kept'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'pickup_at', 'label' => 'Pickup', 'type' => 'date'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'collected', 'label' => 'Collected', 'type' => 'money'],
                ['key' => 'held', 'label' => 'Held', 'type' => 'money'],
                ['key' => 'returned', 'label' => 'Returned', 'type' => 'money'],
                ['key' => 'kept', 'label' => 'Kept', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function expenses(Carbon $from, Carbon $to): array
    {
        $rows = Expense::with('category:id,name', 'vehicle:id,title')
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->orderByDesc('expense_date')->get()
            ->map(fn (Expense $e) => [
                'date' => $e->expense_date->toDateString(),
                'number' => $e->expense_number,
                'category' => $e->category?->name,
                'vehicle' => $e->vehicle?->title,
                'supplier' => $e->vendor_name,
                'total' => (float) $e->total,
            ]);

        $top = $rows->groupBy('category')->map(fn ($group) => $group->sum('total'))->sortDesc();

        return [
            'title' => 'Expenses',
            'description' => 'What the shop spent, by date.',
            'note' => null,
            'summary' => [
                ['label' => 'Total spent', 'value' => $rows->sum('total'), 'type' => 'money'],
                ['label' => 'Expenses', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Biggest category', 'value' => $top->keys()->first() ?: '—', 'type' => 'text'],
                ['label' => 'Spent on it', 'value' => $top->first() ?? 0, 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'type' => 'date'],
                ['key' => 'number', 'label' => 'Number', 'type' => 'text'],
                ['key' => 'category', 'label' => 'Category', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'supplier', 'label' => 'Supplier', 'type' => 'text'],
                ['key' => 'total', 'label' => 'Total', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function cancellations(Carbon $from, Carbon $to): array
    {
        $rows = Booking::with('vehicle:id,title', 'customer:id,name', 'pricing:id,booking_id,subtotal')
            ->whereIn('status', self::LOST_STATUSES)
            ->whereBetween('pickup_at', [$from, $to])
            ->orderByDesc('pickup_at')->get()
            ->map(fn (Booking $b) => [
                'reference' => $b->booking_reference,
                'vehicle' => $b->vehicle?->title,
                'customer' => $b->customer?->name,
                'pickup_at' => $b->pickup_at?->toDateString(),
                'status' => $b->status,
                'reason' => $b->cancellation_reason ?: $b->rejection_reason ?: $b->expiry_reason,
                'value' => (float) ($b->pricing?->subtotal ?? 0),
            ]);

        return [
            'title' => 'Cancellations & No-shows',
            'description' => 'Bookings that did not go ahead, and what they were worth.',
            'note' => null,
            'summary' => [
                ['label' => 'Lost bookings', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Value lost', 'value' => $rows->sum('value'), 'type' => 'money'],
                ['label' => 'No-shows', 'value' => $rows->where('status', Booking::STATUS_NO_SHOW)->count(), 'type' => 'number'],
                ['label' => 'Expired unanswered', 'value' => $rows->where('status', Booking::STATUS_EXPIRED)->count(), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'pickup_at', 'label' => 'Pickup', 'type' => 'date'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'reason', 'label' => 'Reason', 'type' => 'text'],
                ['key' => 'value', 'label' => 'Value', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** The next seven days, so it takes no date range. */
    public function schedule(): array
    {
        $until = now()->addDays(7)->endOfDay();
        $with = ['vehicle:id,title,registration_number', 'customer:id,name,phone'];

        $row = fn (Booking $b, string $kind, Carbon $at) => [
            'when' => $at->format('D d M, h:i A'),
            'sort' => $at->timestamp,
            'kind' => $kind,
            'reference' => $b->booking_reference,
            'vehicle' => $b->vehicle?->title,
            'registration' => $b->vehicle?->registration_number,
            'customer' => $b->customer?->name,
            'phone' => $b->customer?->phone,
        ];

        $pickups = Booking::with($with)->where('status', Booking::STATUS_CONFIRMED)->where('pickup_at', '<=', $until)->get()
            ->map(fn (Booking $b) => $row($b, 'Pickup', $b->pickup_at));
        $returns = Booking::with($with)->where('status', Booking::STATUS_ACTIVE)->where('return_at', '<=', $until)->get()
            ->map(fn (Booking $b) => $row($b, 'Return', $b->return_at));

        return [
            'title' => 'Upcoming Schedule',
            'description' => 'Pickups and returns for the next seven days.',
            'note' => 'Anything overdue is included at the top.',
            'summary' => [
                ['label' => 'Pickups', 'value' => $pickups->count(), 'type' => 'number'],
                ['label' => 'Returns', 'value' => $returns->count(), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'when', 'label' => 'When', 'type' => 'text'],
                ['key' => 'kind', 'label' => 'Type', 'type' => 'text'],
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'registration', 'label' => 'Registration', 'type' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'text'],
            ],
            'rows' => $pickups->concat($returns)->sortBy('sort')->values()->all(),
        ];
    }

    public function damage(Carbon $from, Carbon $to): array
    {
        $rows = BookingDamage::whereHas('booking')
            ->whereBetween('created_at', [$from, $to])
            ->with('booking:id,booking_reference,vehicle_id', 'booking.vehicle:id,title')
            ->orderByDesc('created_at')->get()
            ->map(fn (BookingDamage $d) => [
                'date' => $d->created_at->toDateString(),
                'reference' => $d->booking?->booking_reference,
                'vehicle' => $d->booking?->vehicle?->title,
                'area' => $d->area,
                'severity' => ucfirst((string) $d->severity),
                'description' => $d->description,
                'estimated' => (float) $d->estimated_cost,
                'charged' => (float) $d->charged_amount,
            ]);

        return [
            'title' => 'Damage',
            'description' => 'Damage recorded at return, and what was charged.',
            'note' => null,
            'summary' => [
                ['label' => 'Damage records', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Estimated cost', 'value' => $rows->sum('estimated'), 'type' => 'money'],
                ['label' => 'Charged', 'value' => $rows->sum('charged'), 'type' => 'money'],
                ['label' => 'Not recovered', 'value' => max(0, $rows->sum('estimated') - $rows->sum('charged')), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'type' => 'date'],
                ['key' => 'reference', 'label' => 'Booking', 'type' => 'text'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'area', 'label' => 'Area', 'type' => 'text'],
                ['key' => 'severity', 'label' => 'Severity', 'type' => 'text'],
                ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
                ['key' => 'estimated', 'label' => 'Estimated', 'type' => 'money'],
                ['key' => 'charged', 'label' => 'Charged', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function customers(Carbon $from, Carbon $to): array
    {
        $rows = ShopEarningsQuery::totals($from->toDateString(), $to->toDateString())->with('customer:id,name,phone')->get()
            ->groupBy('customer_id')
            ->map(function ($bookings) {
                $customer = $bookings->first()->customer;

                return [
                    'customer' => $customer?->name,
                    'phone' => $customer?->phone,
                    'bookings' => $bookings->count(),
                    'spent' => (float) $bookings->sum('earnings_amount'),
                    'last_pickup' => $bookings->max('pickup_at')?->toDateString(),
                ];
            })->sortByDesc('spent')->values();

        return [
            'title' => 'Customers',
            'description' => 'Who rents from you, biggest spenders first.',
            'note' => 'Counts bookings that went ahead.',
            'summary' => [
                ['label' => 'Customers', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Repeat customers', 'value' => $rows->where('bookings', '>', 1)->count(), 'type' => 'number'],
                ['label' => 'Income', 'value' => $rows->sum('spent'), 'type' => 'money'],
                ['label' => 'Average per customer', 'value' => $rows->avg('spent') ?? 0, 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'text'],
                ['key' => 'bookings', 'label' => 'Bookings', 'type' => 'number'],
                ['key' => 'spent', 'label' => 'Spent', 'type' => 'money'],
                ['key' => 'last_pickup', 'label' => 'Last pickup', 'type' => 'date'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function enquiries(Carbon $from, Carbon $to): array
    {
        $rows = SaleEnquiry::with('vehicle:id,title')->whereBetween('created_at', [$from, $to])->get()
            ->groupBy('vehicle_id')
            ->map(function ($enquiries) {
                $sold = $enquiries->where('status', SaleEnquiry::STATUS_ACCEPTED)->count();

                return [
                    'vehicle' => $enquiries->first()->vehicle?->title,
                    'enquiries' => $enquiries->count(),
                    'open' => $enquiries->filter->isOpen()->count(),
                    'sold' => $sold,
                    'conversion' => round($sold / $enquiries->count() * 100, 1),
                ];
            })->sortByDesc('enquiries')->values();

        $total = $rows->sum('enquiries');

        return [
            'title' => 'Enquiry Conversion',
            'description' => 'How many enquiries each car got, and how many became a sale.',
            'note' => 'A walk-in sale recorded without an enquiry does not count here.',
            'summary' => [
                ['label' => 'Enquiries', 'value' => $total, 'type' => 'number'],
                ['label' => 'Still open', 'value' => $rows->sum('open'), 'type' => 'number'],
                ['label' => 'Became a sale', 'value' => $rows->sum('sold'), 'type' => 'number'],
                ['label' => 'Conversion', 'value' => $total ? round($rows->sum('sold') / $total * 100, 1) : 0, 'type' => 'percent'],
            ],
            'columns' => [
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'enquiries', 'label' => 'Enquiries', 'type' => 'number'],
                ['key' => 'open', 'label' => 'Open', 'type' => 'number'],
                ['key' => 'sold', 'label' => 'Sold', 'type' => 'number'],
                ['key' => 'conversion', 'label' => 'Conversion', 'type' => 'percent'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** What's on sale today, so it takes no date range. Slowest first, since those need attention. */
    public function unsold(): array
    {
        $enquiries = SaleEnquiry::selectRaw('vehicle_id, COUNT(*) as total')->groupBy('vehicle_id')->pluck('total', 'vehicle_id');

        $rows = Vehicle::forSale()->with('saleDetail')
            ->where('status', Vehicle::STATUS_PUBLISHED)
            ->whereHas('saleDetail', fn ($q) => $q->where('sale_status', VehicleSaleDetail::STATUS_AVAILABLE))
            ->get()
            ->map(fn (Vehicle $v) => [
                'vehicle' => $v->title,
                'listed' => $v->published_at?->toDateString(),
                'days' => $v->published_at ? (int) $v->published_at->diffInDays(now()) : 0,
                'price' => (float) $v->saleDetail->price,
                'views' => (int) $v->view_count,
                'enquiries' => (int) ($enquiries[$v->id] ?? 0),
            ])->sortByDesc('days')->values();

        return [
            'title' => 'Unsold Stock',
            'description' => 'Cars on sale now, longest listed first.',
            'note' => 'Days count from when the car was last published.',
            'summary' => [
                ['label' => 'Cars on sale', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Stock value', 'value' => $rows->sum('price'), 'type' => 'money'],
                ['label' => 'Average days listed', 'value' => (int) round($rows->avg('days') ?? 0), 'type' => 'number'],
                ['label' => 'No enquiries yet', 'value' => $rows->where('enquiries', 0)->count(), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'listed', 'label' => 'Listed', 'type' => 'date'],
                ['key' => 'days', 'label' => 'Days', 'type' => 'number'],
                ['key' => 'price', 'label' => 'Asking', 'type' => 'money'],
                ['key' => 'views', 'label' => 'Views', 'type' => 'number'],
                ['key' => 'enquiries', 'label' => 'Enquiries', 'type' => 'number'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Views are a running total on the listing, so this can't be limited to a period. */
    public function views(): array
    {
        $rows = Vehicle::whereIn('status', [Vehicle::STATUS_PUBLISHED, Vehicle::STATUS_UNPUBLISHED])
            ->orderByDesc('view_count')
            ->get(['id', 'title', 'listing_type', 'status', 'view_count', 'inquiry_count', 'booking_count'])
            ->map(function (Vehicle $v) {
                $views = (int) $v->view_count;
                $leads = (int) $v->inquiry_count + (int) $v->booking_count;

                return [
                    'vehicle' => $v->title,
                    'type' => $v->isForSale() ? 'For sale' : 'Rental',
                    'status' => $v->status,
                    'views' => $views,
                    'enquiries' => (int) $v->inquiry_count,
                    'bookings' => (int) $v->booking_count,
                    'conversion' => $views > 0 ? round(min(100, $leads / $views * 100), 1) : 0,
                ];
            });

        return [
            'title' => 'Listing Views',
            'description' => 'Which listings people look at, and which turn views into interest.',
            'note' => 'All-time totals. Conversion is enquiries and bookings as a share of views.',
            'summary' => [
                ['label' => 'Listings', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Views', 'value' => $rows->sum('views'), 'type' => 'number'],
                ['label' => 'Enquiries', 'value' => $rows->sum('enquiries'), 'type' => 'number'],
                ['label' => 'Bookings', 'value' => $rows->sum('bookings'), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'type' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'views', 'label' => 'Views', 'type' => 'number'],
                ['key' => 'enquiries', 'label' => 'Enquiries', 'type' => 'number'],
                ['key' => 'bookings', 'label' => 'Bookings', 'type' => 'number'],
                ['key' => 'conversion', 'label' => 'Conversion', 'type' => 'percent'],
            ],
            'rows' => $rows->values()->all(),
        ];
    }

    public function promotions(Carbon $from, Carbon $to): array
    {
        $rows = Promotion::with('vehicle:id,title')->where('shop_id', VendorContext::shopId())
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')->get()
            ->map(fn (Promotion $p) => [
                'date' => $p->created_at->toDateString(),
                'reference' => $p->reference_no,
                'type' => $p->type === Promotion::TYPE_FEATURED ? 'Featured vehicle' : 'Shop sponsorship',
                'target' => $p->vehicle?->title ?? $p->city,
                'days' => (int) $p->days,
                'status' => $p->status,
                'amount' => (float) $p->amount,
                'paid' => $p->status === Promotion::STATUS_APPROVED ? (float) $p->amount : 0.0,
            ]);

        return [
            'title' => 'Promotions',
            'description' => 'What you spent on paid visibility.',
            'note' => 'Views and clicks per promotion are not tracked yet.',
            'summary' => [
                ['label' => 'Promotions', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Total spent', 'value' => $rows->sum('paid'), 'type' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'type' => 'date'],
                ['key' => 'reference', 'label' => 'Reference', 'type' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'type' => 'text'],
                ['key' => 'target', 'label' => 'For', 'type' => 'text'],
                ['key' => 'days', 'label' => 'Days', 'type' => 'number'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'status'],
                ['key' => 'amount', 'label' => 'Amount', 'type' => 'money'],
            ],
            'rows' => $rows->all(),
        ];
    }

    public function reviews(Carbon $from, Carbon $to): array
    {
        $rows = Review::with('vehicle:id,title')->where('shop_id', VendorContext::shopId())
            ->where('status', Review::STATUS_PUBLISHED)
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('rating')->orderByDesc('created_at')->get()
            ->map(fn (Review $r) => [
                'date' => $r->created_at->toDateString(),
                'vehicle' => $r->vehicle?->title,
                'rating' => (int) $r->rating,
                'title' => $r->title,
                'replied' => $r->owner_reply ? 'Yes' : 'No',
            ]);

        return [
            'title' => 'Reviews',
            'description' => 'Published reviews, lowest rating first, so you can act on them.',
            'note' => null,
            'summary' => [
                ['label' => 'Reviews', 'value' => $rows->count(), 'type' => 'number'],
                ['label' => 'Average rating', 'value' => round($rows->avg('rating') ?? 0, 1), 'type' => 'number'],
                ['label' => '3 stars or lower', 'value' => $rows->where('rating', '<=', 3)->count(), 'type' => 'number'],
                ['label' => 'Not replied', 'value' => $rows->where('replied', 'No')->count(), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'type' => 'date'],
                ['key' => 'vehicle', 'label' => 'Vehicle', 'type' => 'text'],
                ['key' => 'rating', 'label' => 'Rating', 'type' => 'number'],
                ['key' => 'title', 'label' => 'Title', 'type' => 'text'],
                ['key' => 'replied', 'label' => 'Replied', 'type' => 'text'],
            ],
            'rows' => $rows->all(),
        ];
    }

    /** Hours from a booking request to the shop's decision, and from an enquiry to its first reply, by month. */
    public function response(Carbon $from, Carbon $to): array
    {
        $hours = fn (Carbon $start, Carbon $end) => max(0, $start->diffInMinutes($end)) / 60;

        $bookings = Booking::whereBetween('created_at', [$from, $to])
            ->where(fn ($q) => $q->whereNotNull('accepted_at')->orWhereNotNull('rejected_at'))
            ->get(['id', 'created_at', 'accepted_at', 'rejected_at'])
            ->map(fn (Booking $b) => ['month' => $b->created_at->format('Y-m'), 'hours' => $hours($b->created_at, $b->accepted_at ?? $b->rejected_at)]);

        $enquiries = SaleEnquiry::whereBetween('created_at', [$from, $to])->get(['id', 'created_at']);
        $firstReplies = SaleEnquiryMessage::whereIn('enquiry_id', $enquiries->pluck('id'))
            ->where('sender_type', SaleEnquiry::SENDER_SHOP)
            ->selectRaw('enquiry_id, MIN(created_at) as first_reply')->groupBy('enquiry_id')->pluck('first_reply', 'enquiry_id');

        $replied = $enquiries->filter(fn (SaleEnquiry $e) => isset($firstReplies[$e->id]))
            ->map(fn (SaleEnquiry $e) => ['month' => $e->created_at->format('Y-m'), 'hours' => $hours($e->created_at, Carbon::parse($firstReplies[$e->id]))]);

        $rows = $bookings->pluck('month')->merge($replied->pluck('month'))->unique()->sort()->values()
            ->map(function (string $month) use ($bookings, $replied) {
                $b = $bookings->where('month', $month);
                $e = $replied->where('month', $month);

                return [
                    'month' => Carbon::createFromFormat('Y-m-d', "{$month}-01")->format('M Y'),
                    'bookings' => $b->count(),
                    'booking_hours' => round($b->avg('hours') ?? 0, 1),
                    'enquiries' => $e->count(),
                    'enquiry_hours' => round($e->avg('hours') ?? 0, 1),
                ];
            });

        return [
            'title' => 'Response Time',
            'description' => 'Fast replies win more bookings.',
            'note' => 'Average hours. Booking requests that expired unanswered are in Cancellations & No-shows.',
            'summary' => [
                ['label' => 'Bookings answered', 'value' => $bookings->count(), 'type' => 'number'],
                ['label' => 'Average hours', 'value' => round($bookings->avg('hours') ?? 0, 1), 'type' => 'number'],
                ['label' => 'Enquiries answered', 'value' => $replied->count(), 'type' => 'number'],
                ['label' => 'Enquiries not answered', 'value' => $enquiries->count() - $replied->count(), 'type' => 'number'],
            ],
            'columns' => [
                ['key' => 'month', 'label' => 'Month', 'type' => 'text'],
                ['key' => 'bookings', 'label' => 'Bookings answered', 'type' => 'number'],
                ['key' => 'booking_hours', 'label' => 'Average hours', 'type' => 'number'],
                ['key' => 'enquiries', 'label' => 'Enquiries answered', 'type' => 'number'],
                ['key' => 'enquiry_hours', 'label' => 'Average hours', 'type' => 'number'],
            ],
            'rows' => $rows->all(),
        ];
    }
}
