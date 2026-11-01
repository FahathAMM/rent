<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A shop member's role is their Spatie role (shop-owner / shop-manager /
 * shop-staff) and the owner is rental_shops.owner_user_id — users.shop_role
 * only duplicated that, so it goes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'shop_role')) {
            Schema::table('users', fn (Blueprint $table) => $table->dropColumn('shop_role'));
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('shop_role', ['owner', 'manager', 'staff'])->nullable()->after('shop_id');
        });

        // Rebuild from the sources of truth: shop ownership, then the member's role.
        DB::table('users')->whereNotNull('shop_id')->orderBy('id')->each(function ($u) {
            $isOwner = DB::table('rental_shops')->where('id', $u->shop_id)->value('owner_user_id') == $u->id;
            $roleName = DB::table('model_has_roles')
                ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                ->where('model_has_roles.model_id', $u->id)
                ->whereIn('roles.name', ['shop-manager', 'shop-staff'])
                ->value('roles.name');

            DB::table('users')->where('id', $u->id)->update([
                'shop_role' => $isOwner ? 'owner' : ($roleName === 'shop-manager' ? 'manager' : 'staff'),
            ]);
        });
    }
};
