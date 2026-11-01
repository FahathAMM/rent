<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shop-made roles live in Spatie's own roles table: shop_id NULL = platform
 * role (shop-owner, shop-manager, shop-staff, customer), shop_id set = a role
 * a shop owner created for their shop. Names become unique per shop instead
 * of globally, so two shops can each have a "Driver".
 *
 * Replaces the short-lived separate shop_roles table: any rows in it (and
 * the staff holding them) are carried over into roles / model_has_roles
 * before it's dropped.
 */
return new class extends Migration
{
    private const USER_MODEL = 'App\\Models\\Administration\\User';

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->foreignId('shop_id')->nullable()->after('id')->constrained('rental_shops')->cascadeOnDelete();
            $table->dropUnique(['name', 'guard_name']);
            $table->unique(['shop_id', 'name', 'guard_name']);
        });

        if (Schema::hasTable('shop_roles')) {
            $permissionIds = DB::table('permissions')->pluck('id', 'name');

            foreach (DB::table('shop_roles')->get() as $old) {
                $roleId = DB::table('roles')->insertGetId([
                    'shop_id' => $old->shop_id,
                    'name' => $old->name,
                    'guard_name' => 'web',
                    'created_at' => $old->created_at,
                    'updated_at' => $old->updated_at,
                ]);

                $permissions = collect(json_decode($old->permissions, true) ?: [])
                    ->map(fn ($name) => $permissionIds[$name] ?? null)->filter()->unique();
                DB::table('role_has_permissions')->insert(
                    $permissions->map(fn ($id) => ['permission_id' => $id, 'role_id' => $roleId])->values()->all()
                );

                DB::table('users')->where('shop_role_id', $old->id)->pluck('id')->each(fn ($userId) => DB::table('model_has_roles')->insert([
                    'role_id' => $roleId, 'model_type' => self::USER_MODEL, 'model_id' => $userId,
                ]));
            }

            if (Schema::hasColumn('users', 'shop_role_id')) {
                Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('shop_role_id'));
            }
            Schema::drop('shop_roles');
            DB::table('migrations')->where('migration', '2026_10_31_000004_create_shop_roles_table')->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Shop-made roles can't exist without the column — remove them (and their assignments) first.
        $shopRoleIds = DB::table('roles')->whereNotNull('shop_id')->pluck('id');
        DB::table('model_has_roles')->whereIn('role_id', $shopRoleIds)->delete();
        DB::table('role_has_permissions')->whereIn('role_id', $shopRoleIds)->delete();
        DB::table('roles')->whereIn('id', $shopRoleIds)->delete();

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'name', 'guard_name']);
            $table->dropConstrainedForeignId('shop_id');
            $table->unique(['name', 'guard_name']);
        });
    }
};
