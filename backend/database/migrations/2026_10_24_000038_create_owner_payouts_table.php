<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A manual settlement batch for one shop, one period. The state machine
 * must refuse the transition to `paid` unless evidence_attachment_id or
 * evidence_reference is present - "never mark a payout complete until
 * verified evidence of settlement is recorded." Enforced in
 * OwnerPayout::markPaid() (later phase), not just by convention here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_payouts', function (Blueprint $table) {
            $table->id();
            $table->string('payout_reference')->unique();
            $table->foreignId('shop_id')->constrained('rental_shops')->restrictOnDelete();

            $table->date('period_start');
            $table->date('period_end');
            $table->char('currency', 3)->default('LKR');

            $table->decimal('gross_rental_amount', 12, 2)->default(0);
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->decimal('processing_fee_amount', 12, 2)->default(0);
            $table->decimal('tax_withheld_amount', 12, 2)->default(0);
            $table->decimal('adjustments_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2)->default(0);
            $table->unsignedInteger('booking_count')->default(0);

            $table->enum('status', [
                'draft', 'pending_approval', 'approved', 'processing', 'paid', 'failed', 'cancelled',
            ])->default('draft');

            $table->enum('payout_method', ['bank_transfer', 'cheque', 'cash', 'manual'])->default('bank_transfer');
            $table->foreignId('bank_detail_id')->nullable()->constrained('owner_bank_details')->nullOnDelete();

            $table->date('scheduled_for')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();

            $table->foreignId('evidence_attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
            $table->string('evidence_reference')->nullable();
            $table->timestamp('evidence_recorded_at')->nullable();

            $table->string('failure_reason')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['shop_id', 'status']);
            $table->index(['status', 'scheduled_for']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_payouts');
    }
};
