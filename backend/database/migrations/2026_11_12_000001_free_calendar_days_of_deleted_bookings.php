<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-off clean-up: a platform-deleted booking used to keep its "booked" days
 * in vehicle_availability, so the vehicle calendar still showed them taken.
 * Deleting now frees them (Platform\BookingController::destroy); this frees
 * the days of bookings deleted before that.
 */
return new class extends Migration
{
    public function up(): void
    {
        $deleted = DB::table('bookings')->whereNotNull('deleted_at')->pluck('id');

        if ($deleted->isNotEmpty()) {
            DB::table('vehicle_availability')->whereIn('booking_id', $deleted)->delete();
        }
    }

    public function down(): void
    {
        // Nothing to restore — the rows only blocked days of bookings that no longer exist.
    }
};
