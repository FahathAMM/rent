<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Workplace-context metadata the shop owner legitimately sets about a
 * membership — deliberately NOT gender/date_of_birth/avatar, which are
 * the invited user's own personal account data (users.*), not the
 * shop's to edit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_members', function (Blueprint $table) {
            $table->string('employee_id')->nullable()->after('abilities');
            $table->date('joining_date')->nullable()->after('employee_id');
            $table->string('emergency_contact')->nullable()->after('joining_date');
        });
    }

    public function down(): void
    {
        Schema::table('shop_members', function (Blueprint $table) {
            $table->dropColumn(['employee_id', 'joining_date', 'emergency_contact']);
        });
    }
};
