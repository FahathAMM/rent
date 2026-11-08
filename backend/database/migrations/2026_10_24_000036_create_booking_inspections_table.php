<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Exactly one handover and one return inspection per booking. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->enum('type', ['handover', 'return']);
            $table->unsignedInteger('odometer_reading')->nullable();
            $table->enum('fuel_level', ['empty', 'quarter', 'half', 'three_quarter', 'full'])->nullable();
            $table->json('exterior_checklist')->nullable();
            $table->json('interior_checklist')->nullable();
            $table->json('accessories_checklist')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('customer_present')->default(true);
            $table->string('customer_signature_path')->nullable();
            $table->foreignId('conducted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('conducted_at')->nullable();
            $table->timestamps();

            $table->unique(['booking_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_inspections');
    }
};
