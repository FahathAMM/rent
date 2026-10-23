<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un-applied adjustments are picked up by the next payout cycle; a
 * negative balance carries forward rather than producing a negative
 * transfer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('payout_id')->nullable()->constrained('owner_payouts')->nullOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();

            $table->enum('type', [
                'damage_recovery', 'refund_clawback', 'penalty', 'bonus', 'correction',
                'carry_forward', 'manual',
            ]);
            $table->enum('direction', ['credit', 'debit']);
            $table->decimal('amount', 12, 2);
            $table->string('reason')->nullable();

            $table->enum('status', ['pending', 'applied', 'cancelled'])->default('pending');
            $table->foreignId('created_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('applied_at')->nullable();

            $table->timestamps();

            $table->index(['shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payout_adjustments');
    }
};
