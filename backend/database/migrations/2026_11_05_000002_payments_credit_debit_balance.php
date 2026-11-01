<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Payments become a per-booking statement, like a bank book:
 *  - credit  = money the shop received from the customer,
 *  - debit   = money the shop paid back (e.g. the returned part of a deposit),
 *  - balance = the booking's running net (credits − debits) after this row,
 *              set when the money actually moves (succeeded). Pending or
 *              rejected transfer receipts move nothing, so theirs is null.
 * Replaces the single amount column; existing rows become credits and their
 * balances are rebuilt in the order the money arrived.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('credit', 12, 2)->default(0)->after('type');
            $table->decimal('debit', 12, 2)->default(0)->after('credit');
            $table->decimal('balance', 12, 2)->nullable()->after('debit');
        });

        DB::table('payments')->update(['credit' => DB::raw('amount')]);
        $this->rebuildBalances();

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('amount');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('amount', 12, 2)->default(0)->after('type');
        });
        DB::table('payments')->update(['amount' => DB::raw('CASE WHEN credit > 0 THEN credit ELSE debit END')]);
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['credit', 'debit', 'balance']);
        });
    }

    private function rebuildBalances(): void
    {
        $rows = DB::table('payments')
            ->where('status', 'succeeded')
            ->orderBy('booking_id')
            ->orderByRaw('COALESCE(paid_at, verified_at, created_at)')
            ->orderBy('id')
            ->get(['id', 'booking_id', 'credit', 'debit']);

        $running = [];
        foreach ($rows as $row) {
            $running[$row->booking_id] = round(($running[$row->booking_id] ?? 0) + (float) $row->credit - (float) $row->debit, 2);
            DB::table('payments')->where('id', $row->id)->update(['balance' => $running[$row->booking_id]]);
        }
    }
};
