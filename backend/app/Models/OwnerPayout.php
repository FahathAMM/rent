<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A manual settlement batch for one shop, one period. markPaid() below is
 * the single enforcement point for "never mark a payout complete until
 * verified evidence of settlement is recorded" - the business logic that
 * calls it (later phase) must never bypass this check by writing
 * status = paid directly.
 */
class OwnerPayout extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_APPROVAL = 'pending_approval';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'payout_reference', 'shop_id', 'period_start', 'period_end', 'currency',
        'gross_rental_amount', 'commission_amount', 'processing_fee_amount', 'tax_withheld_amount',
        'adjustments_amount', 'net_amount', 'booking_count', 'status', 'payout_method', 'bank_detail_id',
        'scheduled_for', 'approved_by', 'approved_at', 'paid_by', 'paid_at',
        'evidence_attachment_id', 'evidence_reference', 'evidence_recorded_at', 'failure_reason', 'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'gross_rental_amount' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'processing_fee_amount' => 'decimal:2',
        'tax_withheld_amount' => 'decimal:2',
        'adjustments_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'scheduled_for' => 'date',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
        'evidence_recorded_at' => 'datetime',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function bankDetail(): BelongsTo
    {
        return $this->belongsTo(OwnerBankDetail::class, 'bank_detail_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'approved_by');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'paid_by');
    }

    public function evidenceAttachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class, 'evidence_attachment_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OwnerPayoutItem::class, 'payout_id');
    }

    public function hasSettlementEvidence(): bool
    {
        return (bool) $this->evidence_attachment_id || (bool) $this->evidence_reference;
    }
}
