<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Settling the security deposit at return goes on the customer statement
 * (TransitionBooking::returnVehicle):
 *   deposit_release  credit  the deposit charge is closed (no money moves)
 *   damage           debit   the part the shop keeps, with the reason in `note`
 *   security_deposit debit   (cash) what is handed back to the customer
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE payments MODIFY type ENUM('booking_charge','adjustment','rental','security_deposit','deposit_release','extra','damage','late_fee','balance') NOT NULL");

        Schema::table('payments', function (Blueprint $table) {
            $table->string('note')->nullable()->after('transfer_reference');
        });
    }

    public function down(): void
    {
        DB::table('payments')->where('type', 'deposit_release')->delete();
        DB::statement("ALTER TABLE payments MODIFY type ENUM('booking_charge','adjustment','rental','security_deposit','extra','damage','late_fee','balance') NOT NULL");

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
