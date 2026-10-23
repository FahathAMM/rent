<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only audit trail. Either user_id (a marketplace account) or
 * system_admin_id (a platform admin) identifies the actor - never both.
 * before/after capture the changed state for anything sensitive enough to
 * need it (verification decisions, payouts, refunds, commission edits).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('system_admin_id')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->unsignedBigInteger('shop_id')->nullable();
            $table->string('action'); // create, update, delete, approve, reject, suspend, ...
            $table->string('form'); // controller/module name, e.g. "OwnerVerification"
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('record')->nullable(); // record label, e.g. vehicle title or booking reference
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->enum('severity', ['info', 'notice', 'warning', 'critical'])->default('info');
            $table->json('context')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('browser')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            $table->index(['form', 'record_id']);
            $table->index('user_id');
            $table->index('system_admin_id');
            $table->index('shop_id');
            $table->index('severity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
