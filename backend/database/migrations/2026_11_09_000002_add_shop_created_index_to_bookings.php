<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "This shop's newest bookings" — the vendor dashboard's recent list and
 * the bookings list's default order. Without it MySQL sorts every booking
 * the shop has on each request (≈85 ms at 10k bookings, growing with them).
 */
return new class extends Migration
{
    private const INDEX = 'bookings_shop_id_created_at_index';

    public function up(): void
    {
        if (collect(Schema::getIndexes('bookings'))->contains('name', self::INDEX)) {
            return;
        }
        Schema::table('bookings', function (Blueprint $table) {
            $table->index(['shop_id', 'created_at'], self::INDEX);
        });
    }

    public function down(): void
    {
        if (!collect(Schema::getIndexes('bookings'))->contains('name', self::INDEX)) {
            return;
        }
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(self::INDEX);
        });
    }
};
