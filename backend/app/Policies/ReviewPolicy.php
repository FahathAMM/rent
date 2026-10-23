<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\Review;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

class ReviewPolicy
{
    /** The customer who wrote it may edit their own review within the edit window (enforced by a later-phase service, not here). */
    public function update(User $user, Review $review): bool
    {
        return $review->user_id === $user->id;
    }

    public function reply(User $user, Review $review): bool
    {
        return $review->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::ReviewsReply);
    }
}
