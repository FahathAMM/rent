<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Review;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Notifications\MarketplaceNotification;
use Illuminate\Validation\ValidationException;

/**
 * unique(booking_id) on reviews is the hard backstop against a second
 * review for the same booking - see Review's docblock. Every published
 * review is provably tied to a real completed rental because creation
 * requires status=completed and now() within review_eligible_until.
 */
class ReviewService
{
    public function create(User $user, Booking $booking, array $data): Review
    {
        if ($booking->customer_id !== $user->id) {
            throw ValidationException::withMessages(['booking' => ['This booking does not belong to you.']]);
        }
        if ($booking->status !== Booking::STATUS_COMPLETED) {
            throw ValidationException::withMessages(['booking' => ['Only a completed booking can be reviewed.']]);
        }
        if ($booking->review_eligible_until && now()->greaterThan($booking->review_eligible_until)) {
            throw ValidationException::withMessages(['booking' => ['The review window for this booking has closed.']]);
        }
        if (Review::where('booking_id', $booking->id)->exists()) {
            throw ValidationException::withMessages(['booking' => ['You have already reviewed this booking.']]);
        }

        $review = Review::create($data + [
            'booking_id' => $booking->id,
            'vehicle_id' => $booking->vehicle_id,
            'shop_id' => $booking->shop_id,
            'user_id' => $user->id,
            'status' => Review::STATUS_PENDING,
            'is_verified_booking' => true,
        ]);

        return $review;
    }

    public function reply(User $user, Review $review, string $reply): Review
    {
        $review->update([
            'owner_reply' => $reply,
            'owner_replied_at' => now(),
            'owner_replied_by' => $user->id,
        ]);

        return $review->fresh();
    }

    public function publish(SystemAdmin $admin, Review $review): Review
    {
        $review->update([
            'status' => Review::STATUS_PUBLISHED,
            'moderated_by' => $admin->id,
            'moderated_at' => now(),
            'moderation_reason' => null,
        ]);

        $this->recomputeVehicleRating($review->vehicle_id);
        $this->notifyOwner($review, 'A new review was published for your listing.');

        return $review->fresh();
    }

    public function reject(SystemAdmin $admin, Review $review, string $reason): Review
    {
        $review->update([
            'status' => Review::STATUS_REJECTED,
            'moderated_by' => $admin->id,
            'moderated_at' => now(),
            'moderation_reason' => $reason,
        ]);

        return $review->fresh();
    }

    /** A previously-published review taken down (e.g. reported) - see app-doc/marketplace/05-ui-and-api-map.md "/platform/reviews ... publish · reject · hide (moderator)". */
    public function hide(SystemAdmin $admin, Review $review, string $reason): Review
    {
        $review->update([
            'status' => Review::STATUS_HIDDEN,
            'moderated_by' => $admin->id,
            'moderated_at' => now(),
            'moderation_reason' => $reason,
        ]);

        $this->recomputeVehicleRating($review->vehicle_id);

        return $review->fresh();
    }

    /** rating_avg/rating_count must reflect only the currently-published set — recomputed, never incremented, so hiding/rejecting a review correctly pulls it back out of the average. */
    private function recomputeVehicleRating(int $vehicleId): void
    {
        $agg = Review::where('vehicle_id', $vehicleId)
            ->where('status', Review::STATUS_PUBLISHED)
            ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->first();

        Vehicle::whereKey($vehicleId)->update([
            'rating_avg' => round((float) $agg->avg_rating, 2),
            'rating_count' => (int) $agg->review_count,
        ]);
    }

    private function notifyOwner(Review $review, string $body): void
    {
        $owner = $review->vehicle?->shop?->owner;
        $owner?->notify(new MarketplaceNotification(
            type: 'review_published',
            title: 'New review',
            body: $body,
            actionUrl: '/vendor/reviews',
        ));
    }
}
