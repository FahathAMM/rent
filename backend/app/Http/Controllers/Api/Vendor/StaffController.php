<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\InviteStaffRequest;
use App\Http\Requests\Vendor\UpdateStaffRequest;
use App\Models\Administration\User;
use App\Models\ShopMember;
use App\Services\AuditService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Shop staff management (shop_members, Layer 3 abilities — see
 * app-doc/marketplace/03-permissions-model.md). No invite-token/accept-
 * by-email flow yet — the invited user must already hold a marketplace
 * account, and membership activates immediately rather than waiting on
 * their acceptance. Restricted to the shop's own `owner` role member,
 * same as bank details.
 */
class StaffController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-staff-view')->only('index');
        $this->middleware('can:vendor-staff-create')->only('store');
        $this->middleware('can:vendor-staff-edit')->only('update');
        $this->middleware('can:vendor-staff-delete')->only('destroy');
    }

    private function assertOwner(): void
    {
        abort_unless(VendorContext::membership()?->role === ShopMember::ROLE_OWNER, 403, 'Only the shop owner can manage staff.');
    }

    public function index(): JsonResponse
    {
        $members = ShopMember::where('shop_id', VendorContext::shopId())
            ->whereIn('status', [ShopMember::STATUS_ACTIVE, ShopMember::STATUS_SUSPENDED, ShopMember::STATUS_INVITED])
            ->with('user:id,name,email')
            ->orderBy('role')
            ->get();

        return $this->response('Staff retrieved', $members);
    }

    public function store(InviteStaffRequest $request): JsonResponse
    {
        $this->assertOwner();

        $user = User::where('email', $request->email)->first();

        if (ShopMember::where('shop_id', VendorContext::shopId())->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['email' => ['This person is already a member of this shop.']]);
        }

        $member = ShopMember::create([
            'shop_id' => VendorContext::shopId(),
            'user_id' => $user->id,
            'role' => $request->role,
            'abilities' => $request->abilities ?? [],
            'status' => ShopMember::STATUS_ACTIVE,
            'invited_by' => VendorContext::membership()?->user_id,
            'invited_at' => now(),
            'accepted_at' => now(),
        ])->load('user:id,name,email');

        AuditService::create('ShopMember', $member->id, "{$user->name} ({$member->role})");

        return $this->response('Staff member added', $member, 201);
    }

    public function update(UpdateStaffRequest $request, ShopMember $staff): JsonResponse
    {
        $this->assertOwner();
        abort_unless($staff->shop_id === VendorContext::shopId(), 404);
        abort_if($staff->role === ShopMember::ROLE_OWNER, 422, "The shop owner's role cannot be changed.");

        $old = $staff->only(['role', 'abilities']);
        $staff->update($request->validated());

        AuditService::edit('ShopMember', $staff->id, $staff->user?->name ?? "#{$staff->id}", $old, $staff->only(['role', 'abilities']));

        return $this->response('Staff member updated', $staff->fresh()->load('user:id,name,email'));
    }

    public function destroy(ShopMember $staff): JsonResponse
    {
        $this->assertOwner();
        abort_unless($staff->shop_id === VendorContext::shopId(), 404);
        abort_if($staff->role === ShopMember::ROLE_OWNER, 422, 'The shop owner cannot be removed.');

        $label = $staff->user?->name ?? "#{$staff->id}";
        $staff->update(['status' => ShopMember::STATUS_REVOKED, 'revoked_at' => now()]);

        AuditService::delete('ShopMember', $staff->id, $label);

        return $this->response('Staff member removed');
    }
}
