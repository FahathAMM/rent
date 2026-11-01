<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * booking_status_histories.field gains 'dates': the shop can change a
 * confirmed booking's pickup/return (TransitionBooking::reschedule()), and
 * that change is logged like any other - from_value/to_value hold the old
 * and new "pickup → return" ranges.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE booking_status_histories MODIFY field ENUM('status','payment_status','dates') NOT NULL");
    }

    public function down(): void
    {
        DB::table('booking_status_histories')->where('field', 'dates')->delete();
        DB::statement("ALTER TABLE booking_status_histories MODIFY field ENUM('status','payment_status') NOT NULL");
    }
};
