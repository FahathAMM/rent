<?php

namespace App\Models;

use Spatie\Permission\Contracts\Role as RoleContract;
use Spatie\Permission\Exceptions\RoleAlreadyExists;
use Spatie\Permission\Guard;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Spatie role with an optional shop_id:
 *   - shop_id NULL → a platform role (`customer`);
 *   - shop_id set  → one shop's own role: its `shop-owner` (created on
 *     registration, full access) or one the owner made (e.g. "Manager").
 *
 * Name lookups (findByName, assignRole('customer')) only match platform roles.
 */
class Role extends SpatieRole
{
    /** Holding this role = every vendor permission (Gate::before in AppServiceProvider). */
    public const SHOP_OWNER = 'shop-owner';

    /** Areas only the owner handles — never part of a role the owner creates. */
    public const OWNER_ONLY_PREFIXES = ['vendor-staff-', 'vendor-roles-', 'vendor-finance-bank_details-', 'vendor-subscription-', 'vendor-promotions-', 'vendor-audit-logs-'];

    protected $casts = ['shop_id' => 'integer'];

    public function isShopRole(): bool
    {
        return $this->shop_id !== null;
    }

    /** May a role the owner creates include this permission? Vendor permissions only, minus owner-only areas. */
    public static function isAssignableToShopRole(string $permission): bool
    {
        if (!str_starts_with($permission, 'vendor-')) {
            return false;
        }
        foreach (self::OWNER_ONLY_PREFIXES as $prefix) {
            if (str_starts_with($permission, $prefix)) {
                return false;
            }
        }

        return true;
    }

    /** Roles of this shop. */
    public function scopeOfShop($query, ?int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    /** Roles the owner created for this shop — everything except its shop-owner role. */
    public function scopeStaffRoles($query, ?int $shopId)
    {
        return $query->where('shop_id', $shopId)->where('name', '!=', self::SHOP_OWNER);
    }

    /** The shop's shop-owner role, created if missing. */
    public static function shopOwnerOf(int $shopId): self
    {
        return static::ofShop($shopId)->where('name', self::SHOP_OWNER)->where('guard_name', 'web')->first()
            ?? static::create(['name' => self::SHOP_OWNER, 'guard_name' => 'web', 'shop_id' => $shopId]);
    }

    /** @throws RoleAlreadyExists */
    public static function create(array $attributes = [])
    {
        $attributes['guard_name'] ??= Guard::getDefaultName(static::class);

        $exists = static::query()
            ->where('name', $attributes['name'])
            ->where('guard_name', $attributes['guard_name'])
            ->where(fn ($q) => isset($attributes['shop_id'])
                ? $q->where('shop_id', $attributes['shop_id'])
                : $q->whereNull('shop_id'))
            ->exists();

        if ($exists) {
            throw RoleAlreadyExists::create($attributes['name'], $attributes['guard_name']);
        }

        return static::query()->create($attributes);
    }

    /** Lookups by name/params are platform roles unless a shop_id is given explicitly. */
    protected static function findByParam(array $params = []): ?RoleContract
    {
        $query = static::query();

        if (array_key_exists('shop_id', $params)) {
            $query->where('shop_id', $params['shop_id']);
            unset($params['shop_id']);
        } else {
            $query->whereNull('shop_id');
        }

        foreach ($params as $key => $value) {
            $query->where($key, $value);
        }

        return $query->first();
    }
}
