<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\ShopMember;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

class ShopMemberPolicy
{
    public function viewAny(User $user): bool
    {
        return ShopGate::allowsCurrent($user, ShopAbility::StaffView);
    }

    public function invite(User $user): bool
    {
        return ShopGate::allowsCurrent($user, ShopAbility::StaffManage);
    }

    /**
     * A shop's `owner` membership can never be edited or removed by
     * anyone - including another manager with staff.manage - or a
     * manager could lock the real owner out. See
     * app-doc/marketplace/03-permissions-model.md "Layer 3".
     */
    public function update(User $user, ShopMember $member): bool
    {
        return $member->shop_id === VendorContext::shopId()
            && $member->role !== ShopMember::ROLE_OWNER
            && ShopGate::allowsCurrent($user, ShopAbility::StaffManage);
    }

    public function delete(User $user, ShopMember $member): bool
    {
        return $this->update($user, $member);
    }
}
