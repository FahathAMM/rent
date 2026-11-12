<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * A booking has two legitimate viewers with different rules: the
 * customer who made it (ownership by customer_id, no shop context
 * involved at all) and the shop that owns the vehicle (ownership by
 * shop_id, gated by the member's role permissions). The two never overlap in a single
 * request - a request is either on the account app (no X-Shop-Id, no
 * active shop context) or the vendor app (shop context required).
 */
class BookingPolicy
{
    public function viewAny(User $user): bool
    {
        return ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-view');
    }

    // No customer_id shortcut here: bookings.customer_id points at the `customers` table while this
    // $user is a vendor `users` row — comparing the two ids would let a staff member whose id happens
    // to equal the customer's view or cancel a booking without the bookings permission.
    public function view(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-view');
    }

    /** Accept/reject a pending request. */
    public function respond(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    public function cancel(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    /** Record a handover inspection. */
    public function conductHandover(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    /** Record a return inspection. */
    public function conductReturn(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    public function recordDamage(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    /** Change a confirmed booking's dates, or an active booking's return - the shop only; the customer asks the shop. */
    public function reschedule(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    /** Record a payment the shop received outside the app (cash before pickup, a transfer with no upload). */
    public function recordPayment(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }

    /** Verify or reject a customer's bank transfer receipt - the shop checks its own bank statement. */
    public function reviewTransfer(User $user, Booking $booking): bool
    {
        return $booking->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-vehicles-bookings-edit');
    }
}
