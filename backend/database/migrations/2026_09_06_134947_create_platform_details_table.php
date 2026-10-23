<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-wide branding — a single row read by every tenant's app sidebar
 * (see PlatformDetailController), replacing the old key-value store_settings
 * table for this purpose.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_details', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('logo')->nullable();
            $table->string('tagline')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_details');
    }
};
