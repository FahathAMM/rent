<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * method_detail stores brand + last4 only - no PAN, no CVV, ever. amount
 * is always read from booking_pricing server-side, never accepted from a
 * request - see app-doc/marketplace/04-lifecycles.md "Payment lifecycle".
 */
class Payment extends Model
{
    use SoftDeletes;

    public const STATUS_INITIATED = 'initiated';
    public const STATUS_PENDING = 'pending';
    public const STATUS_AUTHORIZED = 'authorized';
    public const STATUS_SUCCEEDED = 'succeeded';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CHARGEBACK = 'chargeback';

    protected $fillable = [
        'booking_id', 'payment_reference', 'gateway', 'gateway_order_id', 'gateway_payment_id',
        'gateway_status_code', 'type', 'amount', 'currency', 'gateway_fee', 'status',
        'method', 'method_detail', 'paid_at', 'failed_at', 'failure_reason',
        'idempotency_key', 'initiated_by', 'raw_response',
    ];

    protected $hidden = ['raw_response'];

    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_fee' => 'decimal:2',
        'method_detail' => 'array',
        'paid_at' => 'datetime',
        'failed_at' => 'datetime',
        'raw_response' => 'array',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function webhookEvents(): HasMany
    {
        return $this->hasMany(PaymentWebhookEvent::class);
    }
}
