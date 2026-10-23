<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform super-admin identities. Deliberately separate from `users`
 * (customers/owners/staff) - a system admin belongs to no shop and
 * authenticates through the `platform` guard only. admin_role splits
 * platform duties (finance approves payouts, moderator moderates
 * listings, ...) - see app-doc/marketplace/03-permissions-model.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_admins', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('admin_role', ['platform_owner', 'admin', 'finance', 'moderator', 'support'])
                ->default('admin');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('admin_role');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_admins');
    }
};
