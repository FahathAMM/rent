<?php

namespace App\Queries;

use App\Models\RentalShop;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * See PublicVehicleQuery for why this bypass is confined here. Verified
 * owner indicator is derived from verification_status, never from a
 * boolean the frontend could spoof.
 */
class PublicShopQuery
{
    public static function base(): Builder
    {
        return RentalShop::withoutGlobalScope(ShopScope::class)
            ->where('status', 'active')
            ->where('is_published', true);
    }

    public static function findBySlug(string $slug): ?RentalShop
    {
        return self::base()->where('slug', $slug)->first();
    }

    public static function search(array $filters): Builder
    {
        $query = self::base();

        if (!empty($filters['q'])) {
            $query->where('name', 'like', "%{$filters['q']}%");
        }

        if (!empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        if (!empty($filters['verified_only'])) {
            $query->where('verification_status', RentalShop::VERIFICATION_VERIFIED);
        }

        return $query->orderByDesc('rating_avg');
    }
}
