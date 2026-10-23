<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('refund_reference')->unique();

            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('LKR');
            $table->enum('type', [
                'cancellation', 'deposit_return', 'overcharge', 'damage_waiver',
                'goodwill', 'chargeback', 'no_show_partial',
            ]);
            $table->string('reason')->nullable();

            $table->enum('status', ['requested', 'approved', 'processing', 'completed', 'rejected', 'failed'])
                ->default('requested');
            $table->enum('method', ['gateway', 'bank_transfer', 'cash', 'credit_note'])->default('gateway');

            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->string('gateway_refund_id')->nullable();
            $table->timestamp('processed_at')->nullable();

            $table->foreignId('evidence_attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
            $table->string('evidence_reference')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['booking_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
