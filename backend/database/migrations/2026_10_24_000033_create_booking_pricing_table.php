<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Immutable quote snapshot - what we told the customer, written once at
 * request time and never updated. pricing_snapshot is a verbatim copy of
 * vehicle_pricing as it stood, so an owner editing rates tomorrow cannot
 * change what an existing booking owes. snapshot_hash proves it was not
 * edited after the fact. There is no update path on this table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_pricing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->char('currency', 3)->default('LKR');
            $table->json('pricing_snapshot');
            $table->enum('rate_plan', ['daily', 'weekly', 'monthly', 'mixed']);
            $table->json('rate_breakdown');

            $table->decimal('base_amount', 12, 2);
            $table->decimal('extras_amount', 12, 2)->default(0);
            $table->decimal('delivery_amount', 12, 2)->default(0);
            $table->decimal('driver_amount', 12, 2)->default(0);
            $table->decimal('weekend_surcharge_amount', 12, 2)->default(0);

            $table->string('discount_code')->nullable();
            $table->decimal('discount_amount', 12, 2)->default(0);

            $table->decimal('subtotal', 12, 2);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('service_fee', 12, 2)->default(0);

            $table->decimal('security_deposit', 12, 2)->default(0);
            $table->decimal('total_payable', 12, 2);

            $table->unsignedInteger('mileage_allowance_total_km')->nullable();
            $table->decimal('excess_mileage_rate_per_km', 8, 2)->default(0);

            $table->timestamp('computed_at');
            $table->string('computed_by')->default('system');
            $table->string('snapshot_hash', 64);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_pricing');
    }
};
