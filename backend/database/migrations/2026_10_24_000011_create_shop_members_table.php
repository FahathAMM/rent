<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Membership pivot: which users may act for which shop, and with what
 * abilities. This replaces a single users.company_id column precisely so
 * one user can be a customer, own a personal shop and staff another shop
 * at once - see app-doc/marketplace/01-phase1-architecture.md section 2.1.
 *
 * The (user_id, status) index is hit on every single vendor-side request,
 * by ResolveShopContext resolving the active shop from X-Shop-Id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['owner', 'manager', 'staff']);
            $table->json('abilities')->nullable();
            $table->enum('status', ['invited', 'active', 'suspended', 'revoked'])->default('invited');
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('invite_token')->nullable()->unique();
            $table->timestamp('invite_expires_at')->nullable();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['shop_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_members');
    }
};
