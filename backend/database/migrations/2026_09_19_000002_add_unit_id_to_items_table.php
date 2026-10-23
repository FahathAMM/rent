<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->foreignId('unit_id')->nullable()->after('category')->constrained('units')->nullOnDelete();
            $table->dropColumn('unit');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_id');
            $table->string('unit')->default('pcs')->after('category');
        });
    }
};
