<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only financial ledger - the complete auditable transaction
 * history the requirements call for. No updated_at, no soft delete, and
 * no update/delete route is ever exposed on this table; corrections are
 * new reversing entries. Reference columns are plain indexed ids rather
 * than hard FKs, deliberately: an audit ledger must never be blocked by,
 * or lose rows to, FK cascade behaviour on the tables it describes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->date('entry_date');
            $table->enum('account', [
                'customer_receivable', 'platform_cash', 'gateway_fees', 'commission_income',
                'owner_payable', 'deposit_liability', 'refunds_payable', 'tax_payable',
                'damage_recovery', 'adjustments',
            ]);
            $table->enum('direction', ['debit', 'credit']);
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('LKR');

            $table->unsignedBigInteger('booking_id')->nullable();
            $table->unsignedBigInteger('shop_id')->nullable();
            $table->unsignedBigInteger('payout_id')->nullable();
            $table->unsignedBigInteger('payment_id')->nullable();
            $table->unsignedBigInteger('refund_id')->nullable();

            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('memo')->nullable();
            $table->string('batch_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['account', 'entry_date']);
            $table->index('booking_id');
            $table->index(['shop_id', 'account']);
            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
