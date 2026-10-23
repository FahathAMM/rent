<?php

namespace App\Models\Scopes;

use App\Services\AuthUser;
use App\Support\VendorContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Restricts every query on a shop-owned model to the active shop context.
 * This is the enforcement point for "a member of Shop A must never be able
 * to access Shop B's rows" - it runs on every query, including ones built
 * from a raw {id} route parameter, so tampering with an id can never leak
 * another shop's row (it 404s instead).
 *
 * Four branches, checked in order:
 *   1. platform guard        -> unrestricted (cross-shop visibility is the
 *                                point of platform admin endpoints)
 *   2. shop context resolved -> WHERE shop_id = <that shop>, or fail closed
 *                                if the context was explicitly set to null
 *   3. authenticated (users guard) but NO shop context resolved
 *                             -> fail closed (WHERE 1 = 0) - a bug in
 *                                middleware wiring must never leak rows
 *   4. no authenticated guard at all
 *                             -> unrestricted (trusted internal context:
 *                                console command, queue worker, seeder)
 */
class ShopScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (auth('platform')->check()) {
            return;
        }

        if (VendorContext::hasContext()) {
            $shopId = VendorContext::shopId();

            if ($shopId === null) {
                $builder->whereRaw('1 = 0');
                return;
            }

            $builder->where($model->getTable() . '.shop_id', $shopId);
            return;
        }

        if (AuthUser::check()) {
            $builder->whereRaw('1 = 0');
            return;
        }

        // Trusted internal context (console/queue/seeder) with no guard
        // authenticated at all - left unrestricted by design.
    }
}
