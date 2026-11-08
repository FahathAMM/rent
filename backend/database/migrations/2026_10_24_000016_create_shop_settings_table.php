<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->unique()->constrained('rental_shops')->cascadeOnDelete();

            $table->string('booking_prefix')->default('BKG');
            $table->unsignedInteger('next_booking_number')->default(1);
            $table->string('payout_prefix')->default('PO');
            $table->unsignedInteger('next_payout_number')->default(1);
            $table->string('agreement_prefix')->default('AGR');
            $table->unsignedInteger('next_agreement_number')->default(1);
            $table->string('expense_prefix')->default('EXP');
            $table->unsignedInteger('next_expense_number')->default(1);
            $table->string('branch_prefix')->default('BR');
            $table->unsignedInteger('next_branch_number')->default(1);

            $table->unsignedInteger('owner_response_hours')->default(24);
            $table->unsignedInteger('payment_window_hours')->default(12);
            $table->boolean('auto_accept_bookings')->default(false);
            $table->unsignedInteger('advance_notice_hours')->default(4);

            $table->unsignedInteger('default_min_rental_days')->default(1);
            $table->unsignedInteger('default_max_rental_days')->nullable();
            $table->unsignedInteger('free_cancellation_hours')->default(48);
            $table->json('cancellation_tiers')->nullable();

            $table->text('agreement_terms')->nullable();
            $table->text('invoice_footer')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_settings');
    }
};
