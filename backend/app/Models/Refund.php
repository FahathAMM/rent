<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A refund reaches `completed` only with gateway_refund_id or evidence_reference present. */
class Refund extends Model
{
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'booking_id', 'payment_id', 'refund_reference', 'amount', 'currency', 'type', 'reason',
        'status', 'method', 'requested_by', 'approved_by', 'approved_at', 'gateway_refund_id',
        'processed_at', 'evidence_attachment_id', 'evidence_reference', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'approved_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'requested_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'approved_by');
    }

    public function evidenceAttachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class, 'evidence_attachment_id');
    }

    public function isSettled(): bool
    {
        return (bool) $this->gateway_refund_id || (bool) $this->evidence_reference;
    }
}
