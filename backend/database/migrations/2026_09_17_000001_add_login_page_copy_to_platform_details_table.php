<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_details', function (Blueprint $table) {
            $table->string('login_eyebrow')->nullable()->after('tagline');
            $table->string('login_heading')->nullable()->after('login_eyebrow');
            $table->text('login_description')->nullable()->after('login_heading');
        });
    }

    public function down(): void
    {
        Schema::table('platform_details', function (Blueprint $table) {
            $table->dropColumn(['login_eyebrow', 'login_heading', 'login_description']);
        });
    }
};
