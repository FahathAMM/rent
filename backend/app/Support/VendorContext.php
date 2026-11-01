<?php

namespace App\Support;

use App\Models\Administration\User;

/**
 * Resolves "which shop am I acting for right now" for the currently
 * dispatched request.
 *
 * A user belongs to at most one shop (users.shop_id), so the active shop is
 * always the authenticated user's own - resolved and pinned here by
 * ResolveShopContext middleware. Someone running two shops uses two
 * accounts.
 *
 * set() is called from exactly two places: ResolveShopContext and trusted
 * internal contexts (console commands, queued jobs, seeders) acting on
 * behalf of a specific shop. Nothing else may call it - that single call
 * site is what makes shop-boundary enforcement auditable in one place.
 */
final class VendorContext
{
    private static ?int $shopId = null;
    private static bool $contextSet = false;
    private static ?User $member = null;

    public static function shopId(): ?int
    {
        return self::$shopId;
    }

    /** Pin the active shop (ResolveShopContext middleware, or a trusted console/job/seeder context). */
    public static function set(?int $shopId, ?User $member = null): void
    {
        self::$shopId = $shopId;
        self::$contextSet = true;
        self::$member = $member;
    }

    public static function forget(): void
    {
        self::$shopId = null;
        self::$contextSet = false;
        self::$member = null;
    }

    /** Whether an active shop has been explicitly resolved for this request. */
    public static function hasContext(): bool
    {
        return self::$contextSet;
    }

    /** The shop user backing the active context, when set via the middleware. */
    public static function member(): ?User
    {
        return self::$member;
    }
}
