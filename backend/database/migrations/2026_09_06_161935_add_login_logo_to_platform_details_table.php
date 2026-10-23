<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The sidebar logo is a small square icon; the login page's branding panel
 * shows a much larger mark, so it gets its own optional upload rather than
 * stretching the sidebar icon. Falls back to `logo` on the frontend when
 * unset.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_details', function (Blueprint $table) {
            $table->string('login_logo')->nullable()->after('logo');
        });
    }

    public function down(): void
    {
        Schema::table('platform_details', function (Blueprint $table) {
            $table->dropColumn('login_logo');
        });
    }
};
