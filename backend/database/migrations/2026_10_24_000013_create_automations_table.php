<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-admin-visible scheduled tasks (database backup, and later the
 * booking/hold/payment sweepers from the marketplace lifecycle - see
 * app-doc/marketplace/04-lifecycles.md). `interval` picks one of Laravel's
 * named schedule frequencies or the special 'fixed_time' value, in which
 * case `fixed_time` is used instead - the two are mutually exclusive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('interval');
            $table->time('fixed_time')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->string('last_run_status')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automations');
    }
};
