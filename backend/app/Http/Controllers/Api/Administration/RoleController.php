<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    private function formatRole(Role $role): array
    {
        return [
            'id'           => $role->id,
            'name'         => $role->name,
            'permissions'  => $role->permissions->pluck('name')->values(),
            'users_count'  => DB::table('model_has_roles')->where('role_id', $role->id)->count(),
        ];
    }

    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->get();

        AuditService::view('Role', null, '');

        return response()->json(['data' => $roles->map(fn($r) => $this->formatRole($r))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:100|unique:roles,name',
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
        $data = $request->validate([
            'name'          => 'sometimes|string|max:100|unique:roles,name,' . $role->id,
            'permissions'   => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        if (isset($data['name'])) {
            $role->update(['name' => $data['name']]);
        }

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions']);
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::edit('Role', $role->id, $role->name);

        return response()->json([
            'message' => 'Role updated successfully',
            'data'    => $this->formatRole($role->fresh('permissions')),
        ]);
    }

    public function destroy(Role $role): JsonResponse
    {
        if (in_array($role->name, ['customer', 'shop-owner', 'shop-staff'])) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 422);
        }

        $recordName = $role->name;

        $role->delete();
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::delete('Role', $role->id, $recordName);

        return response()->json(['message' => 'Role deleted successfully']);
    }
}
