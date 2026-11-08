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

            // A customer statement: charges are debits, money received is a credit,
            // balance is the running debit - credit per booking.
            $table->enum('type', [
                'booking_charge', 'adjustment', 'rental', 'security_deposit', 'deposit_release',
                'extra', 'damage', 'late_fee', 'balance',
            ]);
            $table->decimal('credit', 12, 2)->default(0);
            $table->decimal('debit', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->nullable();
            $table->char('currency', 3)->default('LKR');

            $table->enum('status', ['pending', 'succeeded', 'failed', 'cancelled'])->default('pending');

            // Money lines only (cash / bank); statement lines like the booking charge have none.
            $table->enum('method', ['cash', 'bank'])->nullable();
            $table->string('transfer_reference')->nullable();
            $table->string('note')->nullable();

            $table->timestamp('paid_at')->nullable();

            $table->string('idempotency_key')->unique();
            $table->foreignId('initiated_by')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();

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
