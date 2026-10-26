<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-managed colour list. hex drives the swatch shown in the UI;
 * vehicles.colour keeps the name denormalised.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_colours', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('hex', 7)->nullable(); // e.g. #FFFFFF
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_colours');
    }
};
