<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Self-registered companies (public sign-up) land in `initiate` — locked
 * out of the app until a Platform Admin activates them (existing
 * Platform\CompanyController@activate flow). Companies created directly by
 * a Platform Admin still default to `active`, unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE companies MODIFY status ENUM('active', 'inactive', 'suspended', 'initiate') NOT NULL DEFAULT 'active'");
    }

    public function down(): void
    {
        DB::statement("UPDATE companies SET status = 'active' WHERE status = 'initiate'");
        DB::statement("ALTER TABLE companies MODIFY status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active'");
    }
};
