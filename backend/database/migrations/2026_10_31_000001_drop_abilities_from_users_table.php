<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shop members no longer carry a per-user ability list: what an owner,
 * manager or staff member may do comes from their role's permissions
 * (shop-owner / shop-manager / shop-staff, see MenuSeeder).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'abilities')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('abilities');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('abilities')->nullable()->after('shop_role');
        });
    }
};
