<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who made the visit, when a customer was signed in — both blank for a guest.
 * customer_name is a copy taken at visit time, so the row keeps it even if
 * the customer is later deleted (customer_id then goes null).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('public_visits', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('path')->constrained('customers')->nullOnDelete();
            $table->string('customer_name')->nullable()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('public_visits', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn('customer_name');
        });
    }
};
