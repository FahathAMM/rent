<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An open dispute sets bookings.has_open_dispute and puts the booking's
 * booking_financials.settlement_status to on_hold - the payout builder
 * skips it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disputes', function (Blueprint $table) {
            $table->id();
            $table->string('dispute_reference')->unique();
            $table->foreignId('booking_id')->constrained('bookings')->restrictOnDelete();
            $table->foreignId('raised_by_user_id')->constrained('users')->restrictOnDelete();
            $table->enum('raised_by_side', ['customer', 'owner', 'staff']);
            $table->enum('against_side', ['customer', 'owner', 'platform']);

            $table->enum('category', [
                'damage', 'no_show', 'overcharge', 'vehicle_condition', 'refund',
                'late_return', 'fraud', 'other',
            ]);
            $table->string('subject');
            $table->text('description');
            $table->decimal('claimed_amount', 10, 2)->nullable();

            $table->enum('status', ['open', 'under_review', 'awaiting_info', 'resolved', 'closed', 'escalated'])
                ->default('open');
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');

            $table->foreignId('assigned_to')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->text('resolution')->nullable();
            $table->decimal('resolution_amount', 10, 2)->nullable();
            $table->enum('resolution_in_favour_of', ['customer', 'owner', 'split', 'none'])->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();

            $table->index(['booking_id']);
            $table->index(['status', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disputes');
    }
};
