<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * method_detail stores brand + last4 only - no PAN, no CVV, ever (the
 * gateway's hosted checkout means card data never touches our servers).
 * idempotency_key is unique - the checkout endpoint uses it to guarantee
 * one payment attempt per request even under a retried POST.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->restrictOnDelete();
            $table->string('payment_reference')->unique();

            $table->enum('gateway', ['payhere', 'bank_transfer', 'cash', 'manual']);
            $table->string('gateway_order_id')->nullable();
            $table->string('gateway_payment_id')->nullable();
            $table->string('gateway_status_code')->nullable();

            $table->enum('type', ['rental', 'security_deposit', 'extra', 'damage', 'late_fee', 'balance'])
                ->default('rental');

            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('LKR');
            $table->decimal('gateway_fee', 10, 2)->default(0);

            $table->enum('status', [
                'initiated', 'pending', 'authorized', 'succeeded', 'failed',
                'cancelled', 'expired', 'chargeback',
            ])->default('initiated');

            $table->enum('method', [
                'visa', 'mastercard', 'amex', 'ezcash', 'mcash', 'genie', 'bank', 'cash', 'other',
            ])->nullable();
            $table->json('method_detail')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('failure_reason')->nullable();

            $table->string('idempotency_key')->unique();
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('raw_response')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['booking_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
