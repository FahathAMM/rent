<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lets an audit_logs row identify a platform admin as the actor (e.g. for
     * impersonation start/stop), without touching the meaning of the existing
     * user_id column (a company user). Purely additive — nothing existing
     * changes shape.
     */
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('system_admin_id')->nullable()->after('user_id')
                ->constrained('system_admins')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('system_admin_id');
        });
    }
};
