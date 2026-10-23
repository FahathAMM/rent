<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * unique(payout_id, booking_id) plus a service-level guarantee that a
 * booking appears in at most one non-cancelled payout - so no booking is
 * ever paid out twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_payout_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payout_id')->constrained('owner_payouts')->cascadeOnDelete();
            $table->foreignId('booking_id')->constrained('bookings')->restrictOnDelete();
            $table->json('financial_snapshot');
            $table->decimal('gross_amount', 12, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->decimal('processing_fee_amount', 12, 2);
            $table->decimal('net_amount', 12, 2);
            $table->timestamps();

            $table->unique(['payout_id', 'booking_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_payout_items');
    }
};
