<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Vehicle;
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
        return ShopGate::allowsCurrent($user, 'vendor-vehicles-list-view');
    }

    public function view(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, $this->permission($vehicle, 'view'));
    }

    public function create(User $user): bool
    {
        return ShopGate::allowsCurrent($user, 'vendor-vehicles-list-create');
    }

    public function update(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, $this->permission($vehicle, 'edit'));
    }

    public function delete(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, $this->permission($vehicle, 'delete'));
    }

    public function publish(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, $this->permission($vehicle, 'edit'));
    }

    public function managePricing(User $user, Vehicle $vehicle): bool
    {
        return $vehicle->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-list-edit');
    }

    /** Sale listings have their own permissions, so a sales role can manage a listing's photos too. */
    private function permission(Vehicle $vehicle, string $action): string
    {
        return $vehicle->isForSale() ? "vendor-sales-listings-{$action}" : "vendor-vehicles-list-{$action}";
    }
}
