<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rewritten far more often than vehicle specs, so it is kept separate from
 * `vehicles`. booking_pricing snapshots this row wholesale at request time,
 * so an owner editing rates tomorrow never changes what an existing
 * booking owes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_pricing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->unique()->constrained('vehicles')->cascadeOnDelete();
            $table->char('currency', 3)->default('LKR');

            $table->decimal('daily_rate', 12, 2);
            $table->decimal('weekly_rate', 12, 2)->nullable();
            $table->decimal('monthly_rate', 12, 2)->nullable();
            $table->decimal('weekend_surcharge_pct', 5, 2)->default(0);

            $table->decimal('security_deposit', 12, 2)->default(0);
            $table->enum('deposit_method', ['prepaid', 'cash_on_pickup', 'waived'])->default('cash_on_pickup');

            $table->unsignedInteger('mileage_allowance_per_day_km')->nullable();
            $table->decimal('excess_mileage_rate_per_km', 8, 2)->default(0);

            $table->decimal('driver_rate_per_day', 10, 2)->nullable();
            $table->boolean('delivery_available')->default(false);
            $table->decimal('delivery_free_radius_km', 6, 2)->nullable();
            $table->decimal('delivery_fee_per_km', 8, 2)->nullable();
            $table->decimal('delivery_flat_fee', 10, 2)->nullable();
            $table->decimal('cleaning_fee', 10, 2)->default(0);
            $table->decimal('late_return_fee_per_hour', 10, 2)->default(0);
            $table->enum('fuel_policy', ['full_to_full', 'prepaid', 'same_level'])->default('full_to_full');

            $table->unsignedInteger('min_rental_days')->default(1);
            $table->unsignedInteger('max_rental_days')->nullable();
            $table->unsignedInteger('advance_notice_hours')->default(4);

            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_pricing');
    }
};
