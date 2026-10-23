<?php

namespace App\Support;

use App\Models\Administration\User;
use App\Models\ShopMember;
use App\Support\ShopAbility;

/**
 * The single check for "may THIS member do THIS action at THIS shop" -
 * Layer 3 of app-doc/marketplace/03-permissions-model.md. Prefers the
 * membership already resolved by ResolveShopContext (no extra query); a
 * direct shop_id lookup is the fallback for the rare caller that needs to
 * check a *different* shop than the active context (there isn't one yet
 * in this codebase, but Policies should not have to care).
 */
final class ShopGate
{
    public static function allows(User $user, int $shopId, ShopAbility|string $ability): bool
    {
        $abilityValue = $ability instanceof ShopAbility ? $ability->value : $ability;

        $membership = VendorContext::membership();

        if (!$membership || $membership->shop_id !== $shopId || $membership->user_id !== $user->id) {
            $membership = ShopMember::where('shop_id', $shopId)
                ->where('user_id', $user->id)
                ->first();
        }

        return (bool) $membership?->isActive() && $membership->hasAbility($abilityValue);
    }

    /** Checks against the already-resolved active shop context. */
    public static function allowsCurrent(User $user, ShopAbility|string $ability): bool
    {
        $shopId = VendorContext::shopId();

        return $shopId !== null && self::allows($user, $shopId, $ability);
    }
}
