<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * status and payment_status are two independent axes - see
 * app-doc/marketplace/04-lifecycles.md. "Awaiting payment" is a derived
 * state (status = accepted AND payment_status in unpaid/initiated/failed),
 * not a status value of its own.
 *
 * shop_id is denormalised from vehicles.shop_id on purpose: without it,
 * every vendor booking query needs a join to vehicles for ShopScope to
 * bite, and a scope that depends on a join is a scope that can be
 * forgotten.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_reference')->unique();

            $table->foreignId('vehicle_id')->constrained('vehicles')->restrictOnDelete();
            $table->foreignId('shop_id')->constrained('rental_shops')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();

            $table->foreignId('pickup_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('pickup_address')->nullable();
            $table->decimal('pickup_latitude', 10, 7)->nullable();
            $table->decimal('pickup_longitude', 10, 7)->nullable();
            $table->foreignId('return_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('return_address')->nullable();
            $table->boolean('delivery_requested')->default(false);
            $table->decimal('delivery_distance_km', 6, 2)->nullable();

            $table->dateTime('pickup_at');
            $table->dateTime('return_at');
            $table->unsignedInteger('rental_days');
            $table->dateTime('actual_pickup_at')->nullable();
            $table->dateTime('actual_return_at')->nullable();

            $table->boolean('with_driver')->default(false);
            $table->unsignedInteger('driver_days')->nullable();

            $table->enum('status', [
                'pending', 'accepted', 'confirmed', 'active', 'completed',
                'rejected', 'expired', 'cancelled_by_customer', 'cancelled_by_owner',
                'cancelled_by_admin', 'no_show',
            ])->default('pending');

            $table->enum('payment_status', [
                'unpaid', 'initiated', 'authorized', 'partially_paid', 'paid',
                'refund_pending', 'partially_refunded', 'refunded', 'failed',
            ])->default('unpaid');

            $table->timestamp('owner_response_deadline_at')->nullable();
            $table->timestamp('payment_deadline_at')->nullable();

            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->enum('cancelled_by_type', ['customer', 'owner', 'staff', 'system_admin', 'system'])->nullable();
            $table->unsignedBigInteger('cancelled_by_id')->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expired_at')->nullable();
            $table->enum('expiry_reason', ['owner_no_response', 'payment_timeout', 'hold_lost'])->nullable();

            $table->text('customer_note')->nullable();
            $table->text('owner_note')->nullable();
            $table->text('internal_note')->nullable();

            $table->boolean('has_open_dispute')->default(false);
            $table->timestamp('review_eligible_until')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['shop_id', 'status']);
            $table->index(['customer_id', 'status']);
            $table->index(['vehicle_id', 'status', 'pickup_at', 'return_at']);
            $table->index(['status', 'owner_response_deadline_at']);
            $table->index(['status', 'payment_deadline_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
