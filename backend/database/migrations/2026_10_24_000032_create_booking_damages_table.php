<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_damages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('inspection_id')->nullable()->constrained('booking_inspections')->nullOnDelete();
            $table->string('area');
            $table->text('description')->nullable();
            $table->enum('severity', ['minor', 'moderate', 'major'])->default('minor');
            $table->decimal('estimated_cost', 10, 2)->nullable();
            $table->decimal('charged_amount', 10, 2)->nullable();
            $table->enum('status', ['reported', 'under_review', 'charged', 'waived', 'disputed', 'resolved'])
                ->default('reported');
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolution_note')->nullable();
            $table->timestamps();

            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_damages');
    }
};
