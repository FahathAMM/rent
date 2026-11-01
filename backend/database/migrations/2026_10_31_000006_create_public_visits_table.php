<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** One row per public page visit (also written to storage/logs/public_visit/<date>.log). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('public_visits', function (Blueprint $table) {
            $table->id();
            $table->string('path', 500)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('isp')->nullable();
            $table->string('timezone', 64)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->nullable()->index();
            $table->index('path');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_visits');
    }
};
