<?php

namespace App\Queries;

use App\Models\Booking;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * One row per booking with rental / earnings / received worked out in SQL,
 * scoped by Booking's ShopScope. Earnings and Reports both read this, so the
 * two can never disagree.
 *
 * Customers pay the shop directly (cash / bank transfer), so earnings are the
 * rental subtotal plus any deposit kept for damage; "received" is what the
 * shop has recorded as paid - security-deposit payments excluded (that money
 * is handed back) but the kept damage included - capped at the earnings.
 *
 * Two shapes, same figures:
 *  - rows()   for a paged list: each figure is a small per-booking subquery,
 *             so only the rows on the page pay for it (and the page count
 *             skips them entirely);
 *  - totals() for anything that reads every row (sums, reports): the shop's
 *             payments are added up in one grouped pass and joined in — a
 *             per-booking subquery over every booking took seconds at ~10k.
 */
class ShopEarningsQuery
{
    /** Statuses where the rental is (or was) actually going ahead. */
    public const STATUSES = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

    /** Money received: money lines only (not the booking charge / adjustments), deposit payments excluded. */
    private const DIRECT = "SUM(CASE WHEN p.method IS NOT NULL AND p.type <> 'security_deposit' THEN p.credit - p.debit ELSE 0 END)";

    /** Deposit kept for damage at return (a "damage" statement line) — income, and already in the shop's hands. */
    private const DAMAGE = "SUM(CASE WHEN p.type = 'damage' THEN p.debit ELSE 0 END)";

    /** Counted statement lines: succeeded, not deleted. */
    private const LINES = "p.status = 'succeeded' AND p.deleted_at IS NULL";

    /** For paged lists — see the class note. */
    public static function rows(?string $from = null, ?string $to = null, ?string $paymentMethod = null, ?string $search = null): Builder
    {
        $perBooking = fn (string $sum) => "(SELECT COALESCE({$sum}, 0) FROM payments p WHERE p.booking_id = bookings.id AND " . self::LINES . ')';

        return self::shape(self::base($from, $to, $paymentMethod, $search), $perBooking(self::DIRECT), $perBooking(self::DAMAGE));
    }

    /** For sums and full reports — see the class note. Same columns and figures as rows(). */
    public static function totals(?string $from = null, ?string $to = null, ?string $paymentMethod = null, ?string $search = null): Builder
    {
        // Only this shop's going-ahead bookings (Booking's ShopScope), so it never scans another shop's payments.
        $sums = DB::table('payments as p')
            ->select('p.booking_id')
            ->selectRaw('COALESCE(' . self::DIRECT . ', 0) as direct')
            ->selectRaw('COALESCE(' . self::DAMAGE . ', 0) as damage')
            ->whereRaw(self::LINES)
            ->whereIn('p.booking_id', self::base($from, $to, $paymentMethod, $search)->select('bookings.id')->toBase())
            ->groupBy('p.booking_id');

        $query = self::base($from, $to, $paymentMethod, $search)->leftJoinSub($sums, 'pt', 'pt.booking_id', '=', 'bookings.id');

        return self::shape($query, 'COALESCE(pt.direct, 0)', 'COALESCE(pt.damage, 0)');
    }

    private static function base(?string $from, ?string $to, ?string $paymentMethod, ?string $search): Builder
    {
        // Plain ranges rather than whereDate(), so the (shop_id, status, deleted_at, pickup_at) index applies.
        return Booking::query()
            ->whereIn('bookings.status', self::STATUSES)
            ->when($from, fn ($q) => $q->where('bookings.pickup_at', '>=', Carbon::parse($from)->startOfDay()))
            ->when($to, fn ($q) => $q->where('bookings.pickup_at', '<', Carbon::parse($to)->addDay()->startOfDay()))
            ->when($paymentMethod, fn ($q) => $q->where('bookings.payment_method', $paymentMethod))
            ->when($search, fn ($q) => $q->where('bookings.booking_reference', 'like', "%{$search}%"));
    }

    private static function shape(Builder $query, string $direct, string $damage): Builder
    {
        $earnings = "(COALESCE(bp.subtotal, 0) + {$damage})";

        return $query
            ->leftJoin('booking_pricing as bp', 'bp.booking_id', '=', 'bookings.id')
            ->select([
                'bookings.id', 'bookings.booking_reference', 'bookings.status', 'bookings.payment_method',
                'bookings.payment_status', 'bookings.pickup_at', 'bookings.return_at', 'bookings.created_at',
                'bookings.vehicle_id', 'bookings.customer_id',
                'bp.currency',
                DB::raw('COALESCE(bp.subtotal, 0) as rental_amount'),
                DB::raw("{$earnings} as earnings_amount"),
            ])
            // What the shop has in hand, capped at the earnings.
            ->selectRaw("LEAST({$direct} + {$damage}, {$earnings}) as received_amount");
    }
}
