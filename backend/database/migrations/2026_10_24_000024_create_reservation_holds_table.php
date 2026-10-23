<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * booking_id is a forward reference to `bookings` (created later in this
 * migration set) so it is a plain indexed column rather than a hard FK.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamp('expires_at');
            $table->enum('status', ['active', 'consumed', 'released', 'expired'])->default('active');
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'status', 'start_date', 'end_date']);
            $table->index(['status', 'expires_at']);
            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_holds');
    }
};
