<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per vehicle per date. unique(vehicle_id, date) is the hard
 * database-level backstop against double booking - see
 * app-doc/marketplace/04-lifecycles.md "Concurrency". booking_id is a
 * forward reference to the `bookings` table (created later in this
 * migration set) so it is a plain indexed column rather than a hard FK.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_availability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->date('date');
            $table->enum('status', ['available', 'blocked', 'booked', 'maintenance'])->default('available');
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['vehicle_id', 'date']);
            $table->index(['vehicle_id', 'date', 'status']);
            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_availability');
    }
};
