<?php

namespace App\Models\Concerns;

use App\Models\RentalShop;
use App\Models\Scopes\ShopScope;
use App\Support\VendorContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Marks a model as shop-owned: every query is scoped to the active shop
 * (ShopScope) and shop_id is stamped automatically on create from the
 * resolved context - a shop_id passed in from the frontend is always
 * ignored in favour of it.
 */
trait BelongsToShop
{
    public static function bootBelongsToShop(): void
    {
        static::addGlobalScope(new ShopScope);

        static::creating(function (Model $model) {
            if (!VendorContext::hasContext()) {
                // Trusted context (console/seeder with no pinned shop):
                // respect an explicitly-set shop_id instead of forcing it,
                // since there may be no context to force.
                return;
            }

            // A normal vendor-side request: always the resolved shop,
            // regardless of any shop_id the request tried to set.
            $model->shop_id = VendorContext::shopId();
        });
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class);
    }
}
