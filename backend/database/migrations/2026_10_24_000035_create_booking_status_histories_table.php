<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only. Written by TransitionBooking (later phase) on every status
 * or payment_status change - never by a controller setting the column
 * directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->enum('field', ['status', 'payment_status']);
            $table->string('from_value')->nullable();
            $table->string('to_value');
            $table->enum('actor_type', ['customer', 'owner', 'staff', 'system_admin', 'system']);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('reason')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_status_histories');
    }
};
