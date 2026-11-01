<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Removes online payments and everything built on the platform holding the
 * money: the PayHere webhook log, commission rules, booking_financials, the
 * ledger, owner payouts (+ items, adjustments), platform refunds and
 * reservation holds - plus the columns, enum values, settings, menus and
 * automations that only served them. Customers now always pay the shop
 * directly (cash at pickup / bank transfer verified by the shop).
 *
 * The full design, schema and removed code are archived in
 * app-doc/marketplace/09-online-payments-archive.md for rebuilding later.
 * The tables themselves (webhook log, commissions, booking_financials,
 * ledger, payouts, refunds, reservation holds) were later removed from the
 * migration history altogether, so this only cleans up columns, enum
 * values, settings, menus and automations.
 */
return new class extends Migration
{
    private const SETTINGS = [
        'online_payments_enabled', 'default_payment_window_hours', 'reservation_hold_minutes',
        'payout_dispute_window_days', 'min_payout_threshold', 'default_commission_percentage',
    ];

    private const AUTOMATIONS = ['Expire Unpaid Bookings', 'Release Expired Holds', 'Build Owner Payouts'];

    public function up(): void
    {
        // ── Data first, while the old enum values are still valid ──────────
        // A request accepted but still waiting for an online payment can never be paid now.
        DB::table('bookings')->where('status', 'accepted')->update([
            'status' => 'expired',
            'expired_at' => now(),
            'expiry_reason' => 'payment_timeout',
        ]);
        DB::table('bookings')->where('payment_method', 'online')->update(['payment_method' => 'cash']);
        DB::table('bookings')->whereIn('payment_status', ['initiated', 'authorized', 'failed'])->update(['payment_status' => 'unpaid']);
        DB::table('bookings')->whereIn('payment_status', ['refund_pending', 'partially_refunded', 'refunded'])->update(['payment_status' => 'paid']);

        // ── Tables ──────────────────────────────────────────────────────────

        // Gateway payments go with the gateway; what is left is money paid to the shop.
        DB::table('payments')->whereNotIn('gateway', ['cash', 'bank_transfer'])->delete();
        DB::table('payments')->whereIn('status', ['initiated', 'authorized'])->update(['status' => 'pending']);
        DB::table('payments')->whereIn('status', ['expired', 'chargeback'])->update(['status' => 'cancelled']);
        DB::table('payments')->whereNotNull('method')->whereNotIn('method', ['cash', 'bank'])->update(['method' => null]);

        // ── Columns ─────────────────────────────────────────────────────────
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['status', 'payment_deadline_at']);
            $table->dropColumn('payment_deadline_at');
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['gateway_order_id', 'gateway_payment_id', 'gateway_status_code', 'gateway_fee', 'raw_response']);
        });
        Schema::table('rental_shops', function (Blueprint $table) {
            $table->dropColumn(['commission_rate_override', 'payout_schedule', 'min_payout_threshold']);
        });
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->dropColumn(['payout_prefix', 'next_payout_number', 'payment_window_hours']);
        });
        Schema::table('vehicle_categories', function (Blueprint $table) {
            $table->dropColumn('commission_rate');
        });

        // ── Enums: only the values the paid-to-shop flow uses ───────────────
        DB::statement("ALTER TABLE bookings MODIFY status ENUM('pending','confirmed','active','completed','rejected','expired','cancelled_by_customer','cancelled_by_owner','cancelled_by_admin','no_show') NOT NULL DEFAULT 'pending'");
        DB::statement("ALTER TABLE bookings MODIFY payment_status ENUM('unpaid','partially_paid','paid') NOT NULL DEFAULT 'unpaid'");
        DB::statement("ALTER TABLE bookings MODIFY payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'");
        DB::statement("ALTER TABLE payments MODIFY gateway ENUM('cash','bank_transfer') NOT NULL");
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending'");
        DB::statement("ALTER TABLE payments MODIFY method ENUM('cash','bank') NULL");

        // ── Settings, menus/permissions, automations ────────────────────────
        DB::table('platform_settings')->whereIn('key', self::SETTINGS)->delete();
        DB::table('automations')->whereIn('name', self::AUTOMATIONS)->delete();

        $permissionIds = DB::table('permissions')->where('name', 'like', 'vendor-finance-payouts-%')->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
        DB::table('menus')->where('audience', 'vendor')->where('slug', 'finance-payouts')->delete();
    }

    /**
     * Brings back the columns and enum values. Rows that
     * up() deleted or changed - gateway payments, expired "accepted"
     * bookings, settings, the payouts menu - are not restored; re-seed
     * (PlatformSettingSeeder / MenuSeeder from the archive) if needed.
     */
    public function down(): void
    {
        Schema::table('vehicle_categories', function (Blueprint $table) {
            $table->decimal('commission_rate', 5, 2)->nullable();
        });
        DB::statement("ALTER TABLE bookings MODIFY status ENUM('pending','accepted','confirmed','active','completed','rejected','expired','cancelled_by_customer','cancelled_by_owner','cancelled_by_admin','no_show') NOT NULL DEFAULT 'pending'");
        DB::statement("ALTER TABLE bookings MODIFY payment_status ENUM('unpaid','initiated','authorized','partially_paid','paid','refund_pending','partially_refunded','refunded','failed') NOT NULL DEFAULT 'unpaid'");
        DB::statement("ALTER TABLE bookings MODIFY payment_method VARCHAR(20) NOT NULL DEFAULT 'online'");
        DB::statement("ALTER TABLE payments MODIFY gateway ENUM('payhere','bank_transfer','cash','manual') NOT NULL");
        DB::statement("ALTER TABLE payments MODIFY status ENUM('initiated','pending','authorized','succeeded','failed','cancelled','expired','chargeback') NOT NULL DEFAULT 'initiated'");
        DB::statement("ALTER TABLE payments MODIFY method ENUM('visa','mastercard','amex','ezcash','mcash','genie','bank','cash','other') NULL");

        Schema::table('shop_settings', function (Blueprint $table) {
            $table->string('payout_prefix')->default('PO');
            $table->unsignedInteger('next_payout_number')->default(1);
            $table->unsignedInteger('payment_window_hours')->default(12);
        });
        Schema::table('rental_shops', function (Blueprint $table) {
            $table->decimal('commission_rate_override', 5, 2)->nullable();
            $table->enum('payout_schedule', ['weekly', 'biweekly', 'monthly', 'manual'])->default('monthly');
            $table->decimal('min_payout_threshold', 12, 2)->nullable();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->string('gateway_order_id')->nullable();
            $table->string('gateway_payment_id')->nullable();
            $table->string('gateway_status_code')->nullable();
            $table->decimal('gateway_fee', 10, 2)->default(0);
            $table->json('raw_response')->nullable();
        });
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('payment_deadline_at')->nullable();
            $table->index(['status', 'payment_deadline_at']);
        });

    }
};
