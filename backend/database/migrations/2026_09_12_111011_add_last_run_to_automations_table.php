<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Written by the schedule's onSuccess()/onFailure() callbacks (see
 * Automation::scheduleSelf()), never by the admin API — not user-editable,
 * so intentionally left out of Automation::$fillable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automations', function (Blueprint $table) {
            $table->timestamp('last_run_at')->nullable()->after('is_active');
            $table->string('last_run_status')->nullable()->after('last_run_at');
        });
    }

    public function down(): void
    {
        Schema::table('automations', function (Blueprint $table) {
            $table->dropColumn(['last_run_at', 'last_run_status']);
        });
    }
};
