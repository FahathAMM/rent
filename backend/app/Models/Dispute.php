<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An open dispute sets bookings.has_open_dispute and the booking's
 * booking_financials.settlement_status to on_hold - the payout builder
 * (later phase) skips it.
 */
class Dispute extends Model
{
    public const STATUS_OPEN = 'open';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_AWAITING_INFO = 'awaiting_info';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_ESCALATED = 'escalated';

    protected $fillable = [
        'dispute_reference', 'booking_id', 'raised_by_user_id', 'raised_by_side', 'against_side',
        'category', 'subject', 'description', 'claimed_amount',
        'status', 'priority', 'assigned_to', 'resolution', 'resolution_amount',
        'resolution_in_favour_of', 'resolved_by', 'resolved_at', 'closed_at',
    ];

    protected $casts = [
        'claimed_amount' => 'decimal:2',
        'resolution_amount' => 'decimal:2',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function raisedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by_user_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'assigned_to');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'resolved_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(DisputeMessage::class);
    }
}
