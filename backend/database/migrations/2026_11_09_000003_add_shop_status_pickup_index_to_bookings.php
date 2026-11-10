<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A shop's going-ahead bookings by pickup date — what Earnings, the dashboard
 * revenue tile and the money reports filter on (ShopEarningsQuery). Includes
 * deleted_at so the whole filter is answered from the index; with only
 * (shop_id, status), MySQL preferred (shop_id, created_at) and read every
 * booking the shop has (≈330 ms vs ≈130 ms at 20k bookings).
 */
return new class extends Migration
{
    private const INDEX = 'bookings_shop_status_deleted_pickup_index';

    public function up(): void
    {
        if (collect(Schema::getIndexes('bookings'))->contains('name', self::INDEX)) {
            return;
        }
        Schema::table('bookings', function (Blueprint $table) {
            $table->index(['shop_id', 'status', 'deleted_at', 'pickup_at'], self::INDEX);
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
