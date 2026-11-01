<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The opening booking_charge used to include the security deposit. It is
 * now two statement lines - the booking charge (rental + tax) and a
 * security_deposit charge (no method) - so the deposit owed is visible on
 * its own. Splits existing charges by each booking's security_deposits
 * amount_required and rebuilds the balances.
 */
return new class extends Migration
{
    public function up(): void
    {
        $charges = DB::table('payments')
            ->join('security_deposits', 'security_deposits.booking_id', '=', 'payments.booking_id')
            ->where('payments.type', 'booking_charge')
            ->where('security_deposits.amount_required', '>', 0)
            ->whereNull('payments.deleted_at')
            ->get(['payments.*', 'security_deposits.amount_required']);

        foreach ($charges as $charge) {
            $alreadySplit = DB::table('payments')->where('booking_id', $charge->booking_id)
                ->where('type', 'security_deposit')->whereNull('method')->exists();
            if ($alreadySplit) {
                continue;
            }

            $deposit = (float) $charge->amount_required;
            DB::table('payments')->where('id', $charge->id)->update(['debit' => round((float) $charge->debit - $deposit, 2)]);
            DB::table('payments')->insert([
                'booking_id' => $charge->booking_id,
                'payment_reference' => 'DEP-' . Str::upper(Str::random(10)),
                'type' => 'security_deposit',
                'debit' => $deposit,
                'credit' => 0,
                'currency' => $charge->currency,
                'status' => 'succeeded',
                'method' => null,
                'paid_at' => $charge->paid_at,
                'idempotency_key' => (string) Str::uuid(),
                'initiated_by' => $charge->initiated_by,
                'verified_by' => $charge->verified_by,
                'verified_at' => $charge->verified_at,
                'created_at' => $charge->created_at,
                'updated_at' => $charge->updated_at,
            ]);
        }

        $this->rebuildBalances();
    }

    public function down(): void
    {
        foreach (DB::table('payments')->where('type', 'security_deposit')->whereNull('method')->get() as $line) {
            DB::table('payments')->where('booking_id', $line->booking_id)->where('type', 'booking_charge')
                ->increment('debit', (float) $line->debit);
            DB::table('payments')->where('id', $line->id)->delete();
        }

        $this->rebuildBalances();
    }

    /** balance = running debits − credits per booking: booking charge, deposit charge, then by date. */
    private function rebuildBalances(): void
    {
        $rows = DB::table('payments')
            ->where('status', 'succeeded')
            ->orderBy('booking_id')
            ->orderByRaw("CASE WHEN type = 'booking_charge' THEN 0 WHEN type = 'security_deposit' AND method IS NULL THEN 1 ELSE 2 END")
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
