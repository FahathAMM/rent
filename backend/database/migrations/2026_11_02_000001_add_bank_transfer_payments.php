<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bank transfer to the shop (used while online_payments_enabled is off):
 * the customer transfers an advance or the full amount to the shop's
 * primary bank account and uploads the receipt; the shop checks its own
 * statement and verifies or rejects it. The receipt is an Attachment on
 * the payment row (document_type 'transfer_proof', private disk).
 *
 * rental_shops.advance_percentage: the advance, as a % of the booking's
 * total_payable (default 5%) — the customer's first transfer is exactly
 * that advance or the full amount. Null means full amount only.
 * payments.status 'pending' means "receipt uploaded, awaiting the shop".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rental_shops', function (Blueprint $table) {
            $table->decimal('advance_percentage', 5, 2)->nullable()->default(5)->after('min_payout_threshold');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('transfer_reference')->nullable()->after('gateway_payment_id');
            $table->foreignId('verified_by')->nullable()->after('initiated_by')->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable()->after('verified_by');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn(['transfer_reference', 'verified_at']);
        });

        Schema::table('rental_shops', function (Blueprint $table) {
            $table->dropColumn('advance_percentage');
        });
    }
};
