<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Dispute;
use App\Support\VendorContext;

/**
 * disputes has no shop_id column of its own (see the migration) - shop
 * ownership is always resolved through the booking it belongs to.
 * Resolving and responding to a dispute's substance is a platform
 * `support` admin action (see app-doc/marketplace/03-permissions-model.md
 * "Platform admin roles"), not a vendor-side ability; a shop member may
 * only view it and add messages.
 */
class DisputePolicy
{
    public function view(User $user, Dispute $dispute): bool
    {
        if ($dispute->raised_by_user_id === $user->id) {
            return true;
        }

        $booking = $dispute->relationLoaded('booking') ? $dispute->booking : $dispute->booking()->first();

        return $booking !== null && $booking->shop_id === VendorContext::shopId();
    }

    public function addMessage(User $user, Dispute $dispute): bool
    {
        return $this->view($user, $dispute) && $dispute->status !== 'closed';
    }
}
