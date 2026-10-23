<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The settlement view - what money actually moved, updated as payments,
 * refunds and payouts happen. Kept separate from booking_pricing (the
 * immutable quote) precisely so we can always prove what was promised
 * versus what was settled.
 *
 * commission_rule_id and payout_id are forward references to
 * platform_commissions and owner_payouts (both created later in this
 * migration set), so they are plain indexed columns rather than hard FKs -
 * this also means a commission rule can later be archived/deleted without
 * being blocked by, or disturbing, bookings that already froze its rate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_financials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->char('currency', 3)->default('LKR');

            $table->decimal('customer_paid_amount', 12, 2)->default(0);
            $table->decimal('security_deposit_held', 12, 2)->default(0);

            $table->decimal('gross_rental_amount', 12, 2)->default(0);
            $table->decimal('commissionable_amount', 12, 2)->default(0);
            $table->unsignedBigInteger('commission_rule_id')->nullable();
            $table->decimal('commission_rate', 5, 2)->nullable();
            $table->decimal('commission_fixed', 10, 2)->nullable();
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->decimal('payment_processing_fee', 10, 2)->default(0);
            $table->enum('processing_fee_borne_by', ['platform', 'owner'])->default('platform');
            $table->decimal('tax_withheld', 10, 2)->default(0);

            $table->decimal('owner_payable_amount', 12, 2)->default(0);
            $table->decimal('platform_net_amount', 12, 2)->default(0);

            $table->decimal('refunded_amount', 12, 2)->default(0);
            $table->decimal('deposit_returned_amount', 12, 2)->default(0);
            $table->decimal('deposit_forfeited_amount', 12, 2)->default(0);
            $table->decimal('damage_charged_amount', 12, 2)->default(0);
            $table->decimal('adjustments_amount', 12, 2)->default(0);

            $table->enum('settlement_status', [
                'not_eligible', 'unsettled', 'in_payout', 'partially_paid', 'paid', 'on_hold',
            ])->default('not_eligible');
            $table->unsignedBigInteger('payout_id')->nullable();
            $table->timestamp('eligible_for_payout_at')->nullable();

            $table->timestamps();

            $table->index('commission_rule_id');
            $table->index('payout_id');
            $table->index(['settlement_status', 'eligible_for_payout_at'], 'booking_financials_settlement_payout_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_financials');
    }
};
