<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * unique(booking_id) - one review per booking, and a booking only becomes
 * reviewable at status = completed within review_eligible_until, so every
 * published review is provably tied to a real completed rental.
 */
class Review extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_HIDDEN = 'hidden';

    protected $fillable = [
        'booking_id', 'vehicle_id', 'shop_id', 'user_id',
        'rating', 'rating_cleanliness', 'rating_condition', 'rating_value',
        'rating_communication', 'rating_accuracy', 'title', 'comment',
        'status', 'moderated_by', 'moderated_at', 'moderation_reason',
        'owner_reply', 'owner_replied_at', 'owner_replied_by',
        'helpful_count', 'is_verified_booking',
    ];

    protected $casts = [
        'moderated_at' => 'datetime',
        'owner_replied_at' => 'datetime',
        'is_verified_booking' => 'boolean',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function moderatedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'moderated_by');
    }

    public function ownerRepliedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_replied_by');
    }
}
