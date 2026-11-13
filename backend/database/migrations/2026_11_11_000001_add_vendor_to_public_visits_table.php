<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vendor app page visits join the same table as public page visits, told
 * apart by `type` (public_visit | vendor_visit). Who made a vendor visit
 * is the signed-in marketplace user and their shop; the names are copies
 * taken at visit time, same as customer_name, so the row keeps them if
 * the user or shop is later deleted (the ids then go null).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('public_visits', function (Blueprint $table) {
            $table->string('type', 32)->default('public_visit')->after('id')->index();
            $table->foreignId('user_id')->nullable()->after('customer_name')->constrained('users')->nullOnDelete();
            $table->string('user_name')->nullable()->after('user_id');
            $table->foreignId('shop_id')->nullable()->after('user_name')->constrained('rental_shops')->nullOnDelete();
            $table->string('shop_name')->nullable()->after('shop_id');
        });
    }

    public function down(): void
    {
        Schema::table('public_visits', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shop_id');
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['type', 'user_name', 'shop_name']);
        });
    }
};
