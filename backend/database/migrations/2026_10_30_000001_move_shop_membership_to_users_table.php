<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One user belongs to at most one shop: the shop link, role and HR fields
 * live on users. Someone running two shops uses two accounts.
 * (The old shop_members pivot these replaced was removed from the history.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('shop_id')->nullable()->after('id')->constrained('rental_shops')->nullOnDelete();
            $table->enum('shop_role', ['owner', 'manager', 'staff'])->nullable()->after('shop_id');
            $table->json('abilities')->nullable()->after('shop_role');
            $table->string('employee_id')->nullable()->after('abilities');
            $table->date('joining_date')->nullable()->after('employee_id');
            $table->string('emergency_contact')->nullable()->after('joining_date');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shop_id');
            $table->dropColumn(['shop_role', 'abilities', 'employee_id', 'joining_date', 'emergency_contact']);
        });
    }
};
