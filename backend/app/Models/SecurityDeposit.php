<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Held by the shop (taken in cash at handover) and settled at the return
 * inspection: released, partly kept (deductions_amount) or forfeited.
 */
class SecurityDeposit extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_HELD = 'held';
    public const STATUS_PARTIALLY_RELEASED = 'partially_released';
    public const STATUS_RELEASED = 'released';
    public const STATUS_FORFEITED = 'forfeited';

    protected $fillable = [
        'booking_id', 'amount_required', 'amount_collected', 'hold_method', 'status',
        'collected_at', 'released_at', 'deductions_amount', 'deduction_reason',
        'decided_by',
    ];

    protected $casts = [
        'amount_required' => 'decimal:2',
        'amount_collected' => 'decimal:2',
        'collected_at' => 'datetime',
        'released_at' => 'datetime',
        'deductions_amount' => 'decimal:2',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
