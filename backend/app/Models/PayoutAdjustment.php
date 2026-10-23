<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un-applied adjustments are picked up by the next payout cycle; a
 * negative balance carries forward rather than producing a negative
 * transfer.
 */
class PayoutAdjustment extends Model
{
    public const TYPE_DAMAGE_RECOVERY = 'damage_recovery';
    public const TYPE_REFUND_CLAWBACK = 'refund_clawback';
    public const TYPE_PENALTY = 'penalty';
    public const TYPE_BONUS = 'bonus';
    public const TYPE_CORRECTION = 'correction';
    public const TYPE_CARRY_FORWARD = 'carry_forward';
    public const TYPE_MANUAL = 'manual';

    protected $fillable = [
        'shop_id', 'payout_id', 'booking_id', 'type', 'direction', 'amount', 'reason',
        'status', 'created_by', 'approved_by', 'applied_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'applied_at' => 'datetime',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(OwnerPayout::class, 'payout_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'created_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'approved_by');
    }
}
