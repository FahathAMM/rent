<?php

namespace App\Support;

use App\Models\Administration\User;

/**
 * The single check for "may THIS user do THIS action at THIS shop": the
 * user must belong to the shop (users.shop_id), be active, and their shop
 * role must allow it: shop-owner allows everything, a role the owner created
 * allows its permissions.
 */
final class ShopGate
{
    public static function allows(User $user, int $shopId, string $permission): bool
    {
        return (int) $user->shop_id === $shopId
            && $user->isActive()
            && $user->hasVendorPermission($permission);
    }

    /** Checks against the already-resolved active shop context. */
    public static function allowsCurrent(User $user, string $permission): bool
    {
        $shopId = VendorContext::shopId();

        return $shopId !== null && self::allows($user, $shopId, $permission);
    }
}
