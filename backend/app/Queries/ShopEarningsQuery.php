<?php

namespace App\Queries;

use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
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
 */
class ShopEarningsQuery
{
    /** Statuses where the rental is (or was) actually going ahead. */
    public const STATUSES = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

    public static function rows(?string $from = null, ?string $to = null, ?string $paymentMethod = null, ?string $search = null): Builder
    {
        $directReceived = Payment::query()
            ->selectRaw('COALESCE(SUM(credit - debit), 0)')
            ->whereColumn('payments.booking_id', 'bookings.id')
            ->whereNotNull('method') // money lines only - not the booking charge / adjustments
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->where('type', '!=', 'security_deposit');

        // Deposit kept for damage at return (a "damage" statement line) — income, and already in the shop's hands.
        $damageKept = "(SELECT COALESCE(SUM(dp.debit), 0) FROM payments dp WHERE dp.booking_id = bookings.id"
            . " AND dp.type = 'damage' AND dp.status = 'succeeded' AND dp.deleted_at IS NULL)";
        $earnings = "(COALESCE(bp.subtotal, 0) + {$damageKept})";

        return Booking::query()
            ->leftJoin('booking_pricing as bp', 'bp.booking_id', '=', 'bookings.id')
            ->whereIn('bookings.status', self::STATUSES)
            ->when($from, fn ($q) => $q->whereDate('bookings.pickup_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('bookings.pickup_at', '<=', $to))
            ->when($paymentMethod, fn ($q) => $q->where('bookings.payment_method', $paymentMethod))
            ->when($search, fn ($q) => $q->where('bookings.booking_reference', 'like', "%{$search}%"))
            ->select([
                'bookings.id', 'bookings.booking_reference', 'bookings.status', 'bookings.payment_method',
                'bookings.payment_status', 'bookings.pickup_at', 'bookings.return_at', 'bookings.created_at',
                'bookings.vehicle_id', 'bookings.customer_id',
                'bp.currency',
                DB::raw('COALESCE(bp.subtotal, 0) as rental_amount'),
                DB::raw("{$earnings} as earnings_amount"),
            ])
            ->selectRaw("LEAST(({$directReceived->toSql()}) + {$damageKept}, {$earnings}) as received_amount", $directReceived->getBindings());
    }
}
