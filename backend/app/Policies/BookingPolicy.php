<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * A booking has two legitimate viewers with different rules: the
 * customer who made it (ownership by customer_id, no shop context
 * involved at all) and the shop that owns the vehicle (ownership by
 * shop_id, gated by ShopAbility). The two never overlap in a single
 * request - a request is either on the account app (no X-Shop-Id, no
 * active shop context) or the vendor app (shop context required).
 */
class BookingPolicy
{
    public function view(User $user, Booking $booking): bool
    {
        if ($booking->customer_id === $user->id) {
            return true;
        }

        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::BookingsView);
    }

    /** Accept/reject a pending request. */
    public function respond(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::BookingsRespond);
    }

    public function cancel(User $user, Booking $booking): bool
    {
        if ($booking->customer_id === $user->id) {
            return true;
        }

        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::BookingsCancel);
    }

    /** Record a handover inspection. */
    public function conductHandover(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::HandoverConduct);
    }

    /** Record a return inspection. */
    public function conductReturn(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ReturnsConduct);
    }

    public function recordDamage(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::DamageRecord);
    }
}
