<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * store_settings was a platform-wide (non-tenant) branding config table
 * whose write endpoints were role:super-admin-only and whose "Branding"
 * settings page was never reachable by any real tenant role (no owner/
 * admin/sales/accountant/staff ever held admin-settings-view). Dropping it
 * along with its controller/repo/model/routes — see MenuSeeder.php history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('store_settings');
    }

    public function down(): void
    {
        Schema::create('store_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('group', 50)->default('general');
            $table->string('type', 30)->default('text');
            $table->string('label', 150);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['group', 'sort_order']);
        });
    }
};
