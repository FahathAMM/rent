<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-wide branding - a single row read by the public site, the
 * account app and every vendor's sidebar (see PlatformDetailController).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_details', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('logo')->nullable();
            $table->string('login_logo')->nullable();
            $table->string('tagline')->nullable();
            $table->string('login_eyebrow')->nullable();
            $table->string('login_heading')->nullable();
            $table->text('login_description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_details');
    }
};
