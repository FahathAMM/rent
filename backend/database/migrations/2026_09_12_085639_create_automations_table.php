<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-admin-managed scheduled tasks (e.g. "Database Backup"). `interval`
 * picks one of Laravel's named schedule frequencies (5 min → hourly, see
 * App\Models\Automation::INTERVALS) or the special 'fixed_time' value, in
 * which case `fixed_time` (a time-of-day, e.g. "02:00") is used instead —
 * the two are mutually exclusive per row, not combined.
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
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automations');
    }
};
