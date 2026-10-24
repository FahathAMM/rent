<?php

namespace App\Queries;

use App\Models\Favorite;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * A customer's favorites span whichever shops they favorited a vehicle
 * from, so - exactly like CustomerBookingQuery - shop-scoping is the
 * wrong question. Sanctioned ShopScope bypass; see
 * tests/Feature/PublicScopeBoundaryTest.php.
 */
class CustomerFavoriteQuery
{
    public static function forUser(int $userId): Builder
    {
        return Favorite::where('user_id', $userId)
            ->with(['vehicle' => fn ($q) => $q->withoutGlobalScope(ShopScope::class)
                ->with(['category', 'shop', 'pricing', 'images' => fn ($q2) => $q2->orderBy('sort_order')->with('attachment')])]);
    }
}
