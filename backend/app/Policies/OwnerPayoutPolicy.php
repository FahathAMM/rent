<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\OwnerPayout;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * Vendor side is read-only by design - building, approving and paying a
 * payout is exclusively a platform `finance` admin action (see
 * app-doc/marketplace/04-lifecycles.md "Payout cycle"), authorized
 * through SystemAdmin::isFinance(), not this policy.
 */
class OwnerPayoutPolicy
{
    public function view(User $user, OwnerPayout $payout): bool
    {
        return $payout->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::PayoutsView);
    }

    public function viewAny(User $user): bool
    {
        return ShopGate::allowsCurrent($user, ShopAbility::PayoutsView);
    }
}
