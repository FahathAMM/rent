<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Services\SubscriptionService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\InviteStaffRequest;
use App\Http\Requests\Vendor\UpdateStaffRequest;
use App\Models\Administration\User;
use App\Services\AuditService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Role;

/**
 * Shop staff management — staff are users rows linked to the shop
 * (users.shop_id). What a member may do is exactly their role's permissions:
 * each holds a role the owner created; the owner (shop-owner) can do
 * everything. The owner
 * creates the staff member's login (name, email, password) here — one
 * account belongs to one shop, so staff never reuse an existing account.
 */
class StaffController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-staff-view')->only(['index', 'roles']);
        $this->middleware('can:vendor-staff-create')->only('store');
        $this->middleware('can:vendor-staff-edit')->only('update');
        $this->middleware('can:vendor-staff-delete')->only('destroy');
    }

    /** The roles the owner created, with what each can do (shown beside the role picker). */
    public function roles(): JsonResponse
    {
        $roles = Role::staffRoles(VendorContext::shopId())->with('permissions:id,name')->orderBy('name')->get()
            ->map(fn (Role $r) => [
                'id'          => $r->id,
                'name'        => $r->name,
                'permissions' => $r->permissions->pluck('name')->sort()->values(),
            ])->values();

        return $this->response('Staff roles retrieved', $roles);
    }

    /** The shop role a validated request picked (role_id is already checked to be this shop's). */
    private function pickedRole(array $data): Role
    {
        return Role::staffRoles(VendorContext::shopId())->findOrFail($data['role_id']);
    }

    private function assertStaffOfThisShop(User $staff): void
    {
        abort_unless((int) $staff->shop_id === VendorContext::shopId(), 404);
    }

    /** The Staff page's row shape: shop fields at the top level, account details under `user`. */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'role' => $user->shopRole(),
            'role_label' => $user->shopRoleLabel(),
            'role_id' => $user->memberRole()?->id,
            'status' => $user->status,
            'employee_id' => $user->employee_id,
            'joining_date' => $user->joining_date?->toDateString(),
            'emergency_contact' => $user->emergency_contact,
            'created_at' => $user->created_at,
            'user' => $user->only(['id', 'name', 'email', 'phone', 'avatar']),
        ];
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as Api\LocationController::index(). */
    public function index(Request $request): JsonResponse
    {
        // Role lives in the roles tables, not a column — "role" sorts owner-first, then by name.
        $sortable = ['status' => 'status', 'created_at' => 'created_at', 'name' => 'name'];
        $sort = $sortable[$request->sort_field] ?? 'name';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';
        $ownerId = VendorContext::member()?->shop?->owner_user_id ?? 0;

        $staff = User::where('shop_id', VendorContext::shopId())
            ->with(['roles:id,name,shop_id', 'shop:id,owner_user_id'])
            ->when($request->search, fn ($q) => $q->where(fn ($u) => $u
                ->where('name', 'like', "%{$request->search}%")
                ->orWhere('email', 'like', "%{$request->search}%")))
            ->orderByRaw('users.id = ? desc', [$ownerId])
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100))
            ->through(fn (User $user) => $this->present($user));

        return response()->json([
            'record' => $staff,
            'message' => 'Staff retrieved successfully',
            'status' => true,
        ]);
    }

    public function store(InviteStaffRequest $request): JsonResponse
    {
        app(SubscriptionService::class)->ensureCanAddStaff(VendorContext::shopId());

        $user = DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'phone' => $request->phone,
                'password' => $request->password, // hashed by the User cast
                'status' => User::STATUS_ACTIVE,
                'email_verified_at' => now(),
                'registration_source' => 'shop_staff',
                'shop_id' => VendorContext::shopId(),
                'employee_id' => $request->employee_id,
                'joining_date' => $request->joining_date,
                'emergency_contact' => $request->emergency_contact,
            ]);

            // Their role's permissions are their access (and open the vendor panel).
            $user->setShopRole($this->pickedRole($request->validated()));

            return $user;
        });

        AuditService::create('ShopStaff', $user->id, "{$user->name} ({$user->shopRoleLabel()})");

        return $this->response('Staff member added', $this->present($user), 201);
    }

    public function update(UpdateStaffRequest $request, User $staff): JsonResponse
    {
        $this->assertStaffOfThisShop($staff);
        abort_if($staff->isShopOwner(), 422, "The shop owner's role cannot be changed.");

        $trackedFields = ['name', 'phone', 'employee_id', 'joining_date', 'emergency_contact'];
        $old = $staff->only($trackedFields) + ['role' => $staff->shopRoleLabel()];

        $data = $request->validated();
        if (blank($data['password'] ?? null)) {
            unset($data['password']); // blank = keep the current password
        }

        DB::transaction(function () use ($staff, $data) {
            $staff->update(array_diff_key($data, ['role_id' => true]));
            $staff->setShopRole($this->pickedRole($data)); // a role change swaps their permissions
        });

        if (isset($data['password'])) {
            $staff->tokens()->delete(); // a reset password signs the staff member out everywhere
        }

        AuditService::edit('ShopStaff', $staff->id, $staff->name, $old, $staff->only($trackedFields) + ['role' => $staff->fresh()->shopRoleLabel()]);

        return $this->response('Staff member updated', $this->present($staff->fresh()));
    }

    /**
     * Unlinks the account from the shop and shuts it out immediately: its
     * shop role (and so every vendor permission) is removed and every token
     * revoked, so a removed member's open session can't keep acting for the shop.
     */
    public function destroy(User $staff): JsonResponse
    {
        $this->assertStaffOfThisShop($staff);
        abort_if($staff->isShopOwner(), 422, 'The shop owner cannot be removed.');

        DB::transaction(function () use ($staff) {
            $staff->update([
                'shop_id' => null,
                'employee_id' => null, 'joining_date' => null, 'emergency_contact' => null,
            ]);
            $staff->setShopRole(null);
            $staff->tokens()->delete();
        });

        AuditService::delete('ShopStaff', $staff->id, $staff->name);

        return $this->response('Staff member removed');
    }
}
