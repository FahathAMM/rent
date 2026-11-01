<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How a booking is paid: 'online' (PayHere checkout before confirmation)
 * or 'cash' (paid to the shop at pickup — used while the platform setting
 * online_payments_enabled is off). Set when the shop accepts the request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('payment_method', 20)->default('online')->after('payment_status');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
