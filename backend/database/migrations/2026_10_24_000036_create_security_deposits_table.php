<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A liability, never revenue - excluded from the commission base and the
 * owner payable until the return inspection decides it. See
 * app-doc/marketplace/04-lifecycles.md "Security deposit".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->decimal('amount_required', 10, 2)->default(0);
            $table->decimal('amount_collected', 10, 2)->default(0);
            $table->enum('hold_method', ['prepaid', 'cash_on_pickup', 'waived'])->default('cash_on_pickup');
            $table->enum('status', ['pending', 'held', 'partially_released', 'released', 'forfeited'])
                ->default('pending');
            $table->timestamp('collected_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->decimal('deductions_amount', 10, 2)->default(0);
            $table->string('deduction_reason')->nullable();
            $table->foreignId('release_refund_id')->nullable()->constrained('refunds')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_deposits');
    }
};
