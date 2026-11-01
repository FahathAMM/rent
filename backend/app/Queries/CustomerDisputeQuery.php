<?php

namespace App\Queries;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Dispute;
use App\Models\Scopes\ShopScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * A dispute can be raised by the customer OR by the shop side (owner /
 * staff) of the same booking - every account gets the customer role on
 * registration (see app-doc/marketplace/03-permissions-model.md), so
 * both sides reach a dispute through the same /disputes endpoints with
 * no shop context at all. Resolving the booking regardless of which
 * side the caller is on means ShopScope is the wrong question here,
 * exactly like CustomerBookingQuery. Sanctioned ShopScope bypass; see
 * tests/Feature/PublicScopeBoundaryTest.php.
 */
class CustomerDisputeQuery
{
    public static function findBooking(string $reference): ?Booking
    {
        return Booking::withoutGlobalScope(ShopScope::class)
            ->with(['customer', 'shop.owner'])
            ->where('booking_reference', $reference)
            ->first();
    }

    public static function findByReference(string $reference): ?Dispute
    {
        return Dispute::where('dispute_reference', $reference)
            ->with(['booking' => fn ($q) => $q->withoutGlobalScope(ShopScope::class), 'raisedBy:id,name'])
            ->first();
    }

    /**
     * Which shop-side role this user holds on the booking, or null if none.
     * Never 'customer': $userId is a users.id, while bookings.customer_id
     * is a customers.id - comparing the two would let a vendor whose id
     * collides with a customer's act as that customer. Customer-raised
     * disputes need the customer guard plus a raiser-type column first.
     */
    public static function resolveSide(int $userId, Booking $booking): ?string
    {
        $user = User::find($userId);

        if (!$user || (int) $user->shop_id !== $booking->shop_id) {
            return null;
        }

        return $user->isShopOwner() ? 'owner' : 'staff';
    }

    /** Every dispute this user is a party to, either as raiser or as the shop side of the booking. */
    public static function forUser(int $userId): Builder
    {
        $shopId = User::whereKey($userId)->value('shop_id');

        return Dispute::where('raised_by_user_id', $userId)
            ->when($shopId, fn (Builder $d) => $d->orWhereHas('booking', fn (Builder $q) => $q
                ->withoutGlobalScope(ShopScope::class)
                ->where('shop_id', $shopId)))
            ->with(['booking' => fn ($q) => $q->withoutGlobalScope(ShopScope::class), 'raisedBy:id,name']);
    }
}
