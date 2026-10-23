<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The sidebar/top-nav tree, now serving three separate navigation trees
 * (audience) off one table - see MenuRepo::getNavigation().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menus', function (Blueprint $table) {
            $table->id();
            $table->enum('audience', ['customer', 'vendor', 'platform'])->default('vendor');
            $table->string('name');
            // Scoped per audience, not globally: the customer and vendor
            // trees are different navigation namespaces and both
            // legitimately want a top-level "dashboard"/"bookings" item -
            // see MenuSeeder. The generated "{slug}-{action}" PERMISSION
            // name stays unqualified by audience on purpose (existing
            // controllers already gate on bare slugs like
            // "expense-expenses-view"), so two menus that happen to share
            // a slug across audiences also share that permission - which
            // is harmless here since every account always holds the
            // 'customer' role.
            $table->string('slug');
            $table->string('route_name')->nullable();
            $table->string('icon')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('menus')->nullOnDelete();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['audience', 'slug']);
            $table->index(['audience', 'parent_id', 'sort_order']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menus');
    }
};
