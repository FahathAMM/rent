<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Commission rules. Resolution order at the moment a booking is confirmed:
 * vehicle-scoped > shop-scoped > category-scoped > global, highest
 * priority first within a tier. The resolved rule's id/rate/amount are
 * then frozen into booking_financials - editing or deleting a rule later
 * never re-prices an existing booking.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_commissions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('scope_type', ['global', 'category', 'shop', 'vehicle']);
            $table->unsignedBigInteger('scope_id')->nullable();

            $table->decimal('percentage', 5, 2)->default(0);
            $table->decimal('fixed_amount', 10, 2)->default(0);
            $table->decimal('min_amount', 10, 2)->nullable();
            $table->decimal('max_amount', 10, 2)->nullable();

            $table->enum('applies_to', ['rental_only', 'rental_plus_extras'])->default('rental_only');
            $table->enum('processing_fee_borne_by', ['platform', 'owner', 'split'])->default('platform');

            $table->integer('priority')->default(0);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('system_admins')->nullOnDelete();

            $table->timestamps();

            $table->index(['scope_type', 'scope_id', 'is_active', 'effective_from'], 'platform_commissions_scope_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_commissions');
    }
};
