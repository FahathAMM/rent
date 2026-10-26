<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * bookings.customer_id / favorites.user_id / reviews.user_id /
 * customer_profiles.user_id - plus reservation_holds.user_id,
 * payments.initiated_by and refunds.requested_by, which are only ever
 * written with a booking's customer_id - now reference the separate `customers`
 * table instead of `users` — customers are no longer a role on the
 * vendor/owner/staff account, see App\Models\Customer.
 *
 * Pre-launch/seeded data only — no real customer accounts to migrate,
 * so existing rows in every table below are truncated rather than
 * remapped (today's customer_id/user_id values are `users.id`s that
 * won't exist in the fresh `customers` table, and MySQL validates
 * existing rows the moment a new FK constraint is added). Mirrors the
 * disable/truncate/re-enable pattern MenuSeeder::run() already uses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ([
            'payment_webhook_events', 'payments', 'refunds', 'security_deposits',
            'dispute_messages', 'disputes',
            'payout_adjustments', 'owner_payout_items',
            'booking_status_histories', 'booking_pricing', 'booking_financials',
            'booking_extras', 'booking_inspections', 'booking_damages',
            'reviews', 'favorites', 'customer_profiles', 'reservation_holds', 'bookings',
        ] as $table) {
            DB::table($table)->truncate();
        }

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->foreign('customer_id')->references('id')->on('customers')->restrictOnDelete();
        });

        Schema::table('favorites', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        Schema::table('reservation_holds', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('customers')->cascadeOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['initiated_by']);
            $table->foreign('initiated_by')->references('id')->on('customers')->nullOnDelete();
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropForeign(['requested_by']);
            $table->foreign('requested_by')->references('id')->on('customers')->nullOnDelete();
        });

        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->foreign('customer_id')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::table('favorites', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('reservation_holds', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['initiated_by']);
            $table->foreign('initiated_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropForeign(['requested_by']);
            $table->foreign('requested_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::enableForeignKeyConstraints();
    }
};
