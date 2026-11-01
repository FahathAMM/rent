<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * payments becomes the booking's customer account statement:
 *  - debit  = what the customer owes more (the booking charge at
 *             confirmation, a price increase, money paid back to them),
 *  - credit = what reduces it (money received, a price decrease, a charge
 *             reversed when the booking is cancelled),
 *  - balance = running debits − credits = what is still owed (negative =
 *             the shop owes the customer).
 * Charge / adjustment rows are not money, so they have no method.
 *
 * Backfill: every booking that was ever confirmed gets its booking_charge
 * (dated confirmed_at); one that was later cancelled / no-show also gets
 * the reversing adjustment. Balances are then rebuilt in date order.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE payments MODIFY type ENUM('booking_charge','adjustment','rental','security_deposit','extra','damage','late_fee','balance') NOT NULL DEFAULT 'rental'");
        DB::statement("ALTER TABLE payments MODIFY method ENUM('cash','bank') NULL");

        $bookings = DB::table('bookings')
            ->join('booking_pricing', 'booking_pricing.booking_id', '=', 'bookings.id')
            ->whereNotNull('bookings.confirmed_at')
            ->whereNull('bookings.deleted_at')
            ->get(['bookings.id', 'bookings.status', 'bookings.customer_id', 'bookings.confirmed_at', 'bookings.cancelled_at', 'bookings.updated_at', 'booking_pricing.total_payable', 'booking_pricing.currency']);

        foreach ($bookings as $b) {
            $this->insertLine($b, 'booking_charge', debit: (float) $b->total_payable, credit: 0, at: $b->confirmed_at);

            if (str_starts_with($b->status, 'cancelled') || $b->status === 'no_show') {
                $this->insertLine($b, 'adjustment', debit: 0, credit: (float) $b->total_payable, at: $b->cancelled_at ?? $b->updated_at);
            }
        }

        $this->rebuildBalances();
    }

    public function down(): void
    {
        DB::table('payments')->whereIn('type', ['booking_charge', 'adjustment'])->delete();
        DB::table('payments')->whereNull('method')->update(['method' => 'cash']);
        DB::statement("ALTER TABLE payments MODIFY method ENUM('cash','bank') NOT NULL");
        DB::statement("ALTER TABLE payments MODIFY type ENUM('rental','security_deposit','extra','damage','late_fee','balance') NOT NULL DEFAULT 'rental'");

        // Back to the cash-book meaning: balance = running money received.
        $running = [];
        foreach (DB::table('payments')->where('status', 'succeeded')->orderBy('booking_id')
            ->orderByRaw('COALESCE(paid_at, verified_at, created_at)')->orderBy('id')->get(['id', 'booking_id', 'credit', 'debit']) as $row) {
            $running[$row->booking_id] = round(($running[$row->booking_id] ?? 0) + (float) $row->credit - (float) $row->debit, 2);
            DB::table('payments')->where('id', $row->id)->update(['balance' => $running[$row->booking_id]]);
        }
    }

    private function insertLine(object $b, string $type, float $debit, float $credit, $at): void
    {
        DB::table('payments')->insert([
            'booking_id' => $b->id,
            'payment_reference' => ($type === 'booking_charge' ? 'CHG-' : 'ADJ-') . Str::upper(Str::random(10)),
            'type' => $type,
            'debit' => $debit,
            'credit' => $credit,
            'currency' => $b->currency ?? 'LKR',
            'status' => 'succeeded',
            'method' => null,
            'paid_at' => $at,
            'idempotency_key' => (string) Str::uuid(),
            'initiated_by' => $b->customer_id,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    /** balance = running debits − credits per booking, in the order things happened. */
    private function rebuildBalances(): void
    {
        $rows = DB::table('payments')
            ->where('status', 'succeeded')
            ->orderBy('booking_id')
            // The booking charge opens the account even if the shop back-dated a payment before confirmation.
            ->orderByRaw("CASE WHEN type = 'booking_charge' THEN 0 ELSE 1 END")
            ->orderByRaw('COALESCE(paid_at, verified_at, created_at)')
            ->orderBy('id')
            ->get(['id', 'booking_id', 'credit', 'debit']);

        $running = [];
        foreach ($rows as $row) {
            $running[$row->booking_id] = round(($running[$row->booking_id] ?? 0) + (float) $row->debit - (float) $row->credit, 2);
            DB::table('payments')->where('id', $row->id)->update(['balance' => $running[$row->booking_id]]);
        }
    }
};
