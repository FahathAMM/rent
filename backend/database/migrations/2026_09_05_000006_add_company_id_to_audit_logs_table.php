<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('id')
                ->constrained()->cascadeOnDelete();
            $table->json('old_values')->nullable()->after('record');
            $table->json('new_values')->nullable()->after('old_values');

            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
            $table->dropColumn(['old_values', 'new_values']);
        });
    }
};
