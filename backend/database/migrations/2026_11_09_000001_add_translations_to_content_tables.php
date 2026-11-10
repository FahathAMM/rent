<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Other-language text for platform-managed content (see
 * App\Models\Concerns\HasTranslations). The existing columns keep the
 * English text; `translations` holds e.g. { "ta": { "name": "..." } }.
 */
return new class extends Migration
{
    private const TABLES = ['vehicle_categories', 'help_items', 'hero_slides', 'platform_details'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasColumn($table, 'translations')) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) {
                $t->json('translations')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (!Schema::hasColumn($table, 'translations')) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn('translations');
            });
        }
    }
};
