<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

/**
 * Platform-wide roles and what each may do (the Roles & Permissions page) —
 * roles with no shop_id, i.e. `customer`. Shop roles (shop-owner, manager,
 * staff, ...) belong to each shop and are managed by its owner. Listing is
 * open to platform admins; changes are Platform Owner only (routes/platform.php).
 */
class RoleController extends Controller
{
    /** Built-in roles the app refers to by name — editable permissions, but never renamed or deleted. */
    private const SYSTEM_ROLES = [
        'customer'     => ['audience' => 'customer', 'label' => 'Customer', 'description' => 'Every customer account.'],
    ];

    private function formatRole(Role $role): array
    {
        $system = self::SYSTEM_ROLES[$role->name] ?? null;

        return [
            'id'          => $role->id,
            'name'        => $role->name,
            'label'       => $system['label'] ?? ucwords(str_replace(['-', '_'], ' ', $role->name)),
            'description' => $system['description'] ?? null,
            'audience'    => $system['audience'] ?? (str_contains($role->name, '-') ? strstr($role->name, '-', true) : null),
            'is_system'   => $system !== null,
            'permissions' => $role->permissions->pluck('name')->values(),
            'users_count' => DB::table('model_has_roles')->where('role_id', $role->id)->count(),
        ];
    }

    public function index(): JsonResponse
    {
        $order = array_flip(array_keys(self::SYSTEM_ROLES));
        // Platform roles only — roles a shop made for itself (shop_id set) are that shop's business.
        $roles = Role::whereNull('shop_id')->with('permissions')->get()->sortBy(fn (Role $r) => $order[$r->name] ?? 99)->values();

        AuditService::view('Role', null, '');

        return response()->json(['data' => $roles->map(fn ($r) => $this->formatRole($r))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:100', Rule::unique('roles', 'name')->whereNull('shop_id')],
            'permissions'   => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::create('Role', $role->id, $role->name);

        return response()->json([
            'message' => 'Role created successfully',
            'data'    => $this->formatRole($role->load('permissions')),
        ], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        abort_if($role->isShopRole(), 404);
        $data = $request->validate([
            'name'          => ['sometimes', 'string', 'max:100', Rule::unique('roles', 'name')->whereNull('shop_id')->ignore($role->id)],
            'permissions'   => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $system = self::SYSTEM_ROLES[$role->name] ?? null;

        if (isset($data['name']) && $system && $data['name'] !== $role->name) {
            throw ValidationException::withMessages(['name' => ['System roles cannot be renamed — the app refers to them by name.']]);
        }
        // A role only gets permissions from its own side — a customer can never be granted vendor pages, or vice versa.
        if (array_key_exists('permissions', $data) && $system) {
            $foreign = collect($data['permissions'])->reject(fn ($p) => str_starts_with($p, "{$system['audience']}-"));
            if ($foreign->isNotEmpty()) {
                throw ValidationException::withMessages(['permissions' => ["{$system['label']} can only have {$system['audience']} permissions."]]);
            }
        }

        $old = $role->permissions->pluck('name')->sort()->values()->all();

        if (isset($data['name'])) {
            $role->update(['name' => $data['name']]);
        }
        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions']);
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = $role->fresh('permissions');
        AuditService::edit('Role', $role->id, $role->name, ['permissions' => $old], ['permissions' => $role->permissions->pluck('name')->sort()->values()->all()]);

        return response()->json([
            'message' => 'Role updated successfully',
            'data'    => $this->formatRole($role),
        ]);
    }

    public function destroy(Role $role): JsonResponse
    {
        abort_if($role->isShopRole(), 404);
        if (isset(self::SYSTEM_ROLES[$role->name])) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 422);
        }

        $recordName = $role->name;

        $role->delete();
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::delete('Role', $role->id, $recordName);

        return response()->json(['message' => 'Role deleted successfully']);
    }
}
