<?php

namespace App\Support;

use App\Models\ShopMember;

/**
 * Resolves "which shop am I acting for right now" for the currently
 * dispatched request.
 *
 * This is NOT the same job the old Tenant::id() did. There, a user
 * belonged to exactly one company (a column on `users`), so "the current
 * tenant" was always well-defined from the authenticated user alone. Here
 * a user may belong to zero, one, or many shops (see shop_members), so
 * there is no single "the user's shop" to default to - the active shop is
 * resolved per-request from an X-Shop-Id header, validated against
 * shop_members, and pinned here by ResolveShopContext middleware.
 *
 * set() is called from exactly two places: ResolveShopContext (the only
 * place an X-Shop-Id header is ever read) and trusted internal contexts
 * (console commands, queued jobs, seeders) acting on behalf of a specific
 * shop. Nothing else may call it - that single call site is what makes
 * shop-boundary enforcement auditable in one place.
 */
final class VendorContext
{
    private static ?int $shopId = null;
    private static bool $contextSet = false;
    private static ?ShopMember $membership = null;

    public static function shopId(): ?int
    {
        return self::$shopId;
    }

    /** Pin the active shop (ResolveShopContext middleware, or a trusted console/job/seeder context). */
    public static function set(?int $shopId, ?ShopMember $membership = null): void
    {
        self::$shopId = $shopId;
        self::$contextSet = true;
        self::$membership = $membership;
    }

    public static function forget(): void
    {
        self::$shopId = null;
        self::$contextSet = false;
        self::$membership = null;
    }

    /** Whether an active shop has been explicitly resolved for this request. */
    public static function hasContext(): bool
    {
        return self::$contextSet;
    }

    /** The resolved shop_members row backing the active context, when set via the middleware. */
    public static function membership(): ?ShopMember
    {
        return self::$membership;
    }
}
