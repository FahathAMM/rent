<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * unique(payout_id, booking_id) plus a service-level guarantee (later
 * phase) that a booking appears in at most one non-cancelled payout - so
 * no booking is ever paid out twice.
 */
class OwnerPayoutItem extends Model
{
    protected $table = 'owner_payout_items';

    protected $fillable = [
        'payout_id', 'booking_id', 'financial_snapshot',
        'gross_amount', 'commission_amount', 'processing_fee_amount', 'net_amount',
    ];

    protected $casts = [
        'financial_snapshot' => 'array',
        'gross_amount' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'processing_fee_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
    ];

    public function payout(): BelongsTo
    {
        return $this->belongsTo(OwnerPayout::class, 'payout_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
