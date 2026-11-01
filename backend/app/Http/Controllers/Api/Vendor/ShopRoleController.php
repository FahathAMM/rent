<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\AuditService;
use App\Support\PermissionCatalogue;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The shop owner's own roles (vendor Roles & Permissions page). They're
 * ordinary Spatie roles with roles.shop_id set to the shop. Shop owner only.
 * The shop-owner role itself (full access) isn't listed or editable, and
 * another shop's roles are never visible.
 */
class ShopRoleController extends Controller
{
    use JsonResponseTrait;

    /** Names reserved for the owner role and platform roles. */
    private const RESERVED_NAMES = ['owner', Role::SHOP_OWNER, 'customer'];

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            abort_unless(VendorContext::member()?->isShopOwner(), 403, 'Only the shop owner can manage roles.');

            return $next($request);
        });
    }

    public function index(): JsonResponse
    {
        $roles = Role::staffRoles(VendorContext::shopId())->with('permissions:id,name')->orderBy('name')->get()
            ->map(fn (Role $r) => $this->present($r));

        return $this->response('Roles retrieved', $roles);
    }

    /** What a shop role may include: every vendor permission except the owner-only areas. */
    public function permissions(): JsonResponse
    {
        return $this->response('Permissions retrieved', PermissionCatalogue::groups('vendor', fn ($p) => Role::isAssignableToShopRole($p)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $role = DB::transaction(function () use ($data) {
            $role = Role::create(['name' => $data['name'], 'guard_name' => 'web', 'shop_id' => VendorContext::shopId()]);
            $role->syncPermissions($data['permissions']);

            return $role;
        });

        AuditService::create('Role', $role->id, $role->name);

        return $this->response('Role created', $this->present($role), 201);
    }

    public function update(Request $request, int $role): JsonResponse
    {
        $role = $this->findOwn($role);
        $data = $this->validated($request, $role);
        $old = ['name' => $role->name, 'permissions' => $role->permissions->pluck('name')->sort()->values()->all()];

        DB::transaction(function () use ($role, $data) {
            $role->update(['name' => $data['name']]);
            $role->syncPermissions($data['permissions']);
        });

        $role->refresh();
        AuditService::edit('Role', $role->id, $role->name, $old, ['name' => $role->name, 'permissions' => $role->permissions->pluck('name')->sort()->values()->all()]);

        return $this->response('Role updated', $this->present($role));
    }

    public function destroy(int $role): JsonResponse
    {
        $role = $this->findOwn($role);
        $inUse = $role->users()->count();
        abort_if($inUse > 0, 422, "This role is assigned to {$inUse} staff " . ($inUse === 1 ? 'member' : 'members') . '. Give them another role first.');

        $role->delete();
        AuditService::delete('Role', $role->id, $role->name);

        return $this->response('Role deleted');
    }

    /** Only roles this shop's owner created — shop-owner, platform or another shop's role is a 404. */
    private function findOwn(int $id): Role
    {
        return Role::staffRoles(VendorContext::shopId())->findOrFail($id);
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::notIn(self::RESERVED_NAMES),
                Rule::unique('roles', 'name')->where('shop_id', VendorContext::shopId())->where('guard_name', 'web')->ignore($role?->id),
            ],
            'permissions'   => ['present', 'array'],
            'permissions.*' => ['string', 'distinct', 'exists:permissions,name', function ($attr, $value, $fail) {
                if (!Role::isAssignableToShopRole($value)) {
                    $fail('Staff management, roles and bank details stay with the shop owner and can\'t be given to a role.');
                }
            }],
        ], ['name.not_in' => 'That name is reserved for the platform roles — pick another.']);

        $data['name'] = trim($data['name']);
        $data['permissions'] = array_values(array_unique($data['permissions']));

        return $data;
    }

    private function present(Role $role): array
    {
        return [
            'id'          => $role->id,
            'name'        => $role->name,
            'permissions' => $role->permissions->pluck('name')->sort()->values(),
            'users_count' => $role->users()->count(),
        ];
    }
}
