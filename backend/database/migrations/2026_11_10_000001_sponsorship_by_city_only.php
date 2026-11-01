<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sponsorship is by city only now: a shop sponsors its own city (promotions.city).
 * The category option is gone, so its columns are too. Any category sponsorship
 * (there were none in use) is removed first.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('promotions')->where('target_type', 'category')->delete();

        Schema::table('promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn('target_type');
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->string('target_type', 20)->nullable()->after('vehicle_id');
            $table->foreignId('category_id')->nullable()->after('target_type')->constrained('vehicle_categories')->cascadeOnDelete();
        });
        DB::table('promotions')->where('type', 'sponsored')->update(['target_type' => 'city']);
    }
};
