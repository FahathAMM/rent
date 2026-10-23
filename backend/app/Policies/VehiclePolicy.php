<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Vehicle;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * Defense in depth, not the only check: ShopScope has already filtered
 * $vehicle to the active shop before route-model binding resolves it (an
 * IDOR attempt 404s before this policy ever runs). This re-asserts
 * shop_id explicitly anyway, because correctness should not depend on
 * every future query remembering the global scope - see
 * app-doc/marketplace/03-permissions-model.md "An owner cannot accept a
 * booking they do not manage".
 */
class VehiclePolicy
{
    public function viewAny(User $user): bool
    {
        return ShopGate::allowsCurrent($user, ShopAbility::ListingsView);
    }

    public function view(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ListingsView);
    }

    public function create(User $user): bool
    {
        return ShopGate::allowsCurrent($user, ShopAbility::ListingsCreate);
    }

    public function update(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ListingsEdit);
    }

    public function delete(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ListingsArchive);
    }

    public function publish(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ListingsPublish);
    }

    public function managePricing(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::PricingManage);
    }

    public function manageAvailability(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::AvailabilityManage);
    }
}
