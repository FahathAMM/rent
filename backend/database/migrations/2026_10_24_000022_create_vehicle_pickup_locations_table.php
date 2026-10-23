<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_pickup_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->boolean('is_default')->default(false);
            $table->boolean('delivery_allowed')->default(false);
            $table->timestamps();

            $table->unique(['vehicle_id', 'location_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_pickup_locations');
    }
};
