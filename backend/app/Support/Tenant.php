<?php

namespace App\Support;

use App\Services\AuthUser;

/**
 * Resolves the "current company" for tenant-scoped queries and writes.
 *
 * Default source of truth is the authenticated user's company_id — never
 * trust a company_id sent from the frontend. An explicit override (set())
 * exists only for trusted internal contexts (console commands, queued jobs,
 * seeders) that need to act on behalf of a specific company without an
 * authenticated request user.
 */
final class Tenant
{
    private static ?int $overrideId = null;
    private static bool $overrideSet = false;

    public static function id(): ?int
    {
        if (self::$overrideSet) {
            return self::$overrideId;
        }

        return AuthUser::user()?->company_id;
    }

    /** Explicitly pin the tenant context (console commands, jobs, seeders). */
    public static function set(?int $companyId): void
    {
        self::$overrideId = $companyId;
        self::$overrideSet = true;
    }

    public static function forget(): void
    {
        self::$overrideId = null;
        self::$overrideSet = false;
    }

    /**
     * Whether there is any tenant context to scope by at all — an
     * authenticated company user, or an explicit override. False in
     * "trusted internal" contexts (artisan, queue worker, seeders) with no
     * override, which the CompanyScope treats as unrestricted rather than
     * denying. Deliberately checks AuthUser::user() (not Auth::check()):
     * a request authenticated on the `platform` guard has no company user
     * at all, so it must fall into this "trusted" branch too, or a platform
     * admin's writes would get an incorrect company_id=null forced onto them.
     */
    public static function hasContext(): bool
    {
        return self::$overrideSet || AuthUser::user() !== null;
    }

    /** Platform super-admin: bypasses tenant scoping entirely (sees every company). */
    public static function isPlatformAdmin(): bool
    {
        return (bool) AuthUser::user()?->hasRole('super-admin');
    }
}
