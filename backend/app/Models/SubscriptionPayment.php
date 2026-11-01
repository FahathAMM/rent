<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/** A shop's bank transfer to the platform for a plan, with its receipt; a platform admin approves or rejects it. */
class SubscriptionPayment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'reference_no', 'shop_id', 'plan_id', 'periods', 'amount', 'bank_reference', 'status',
        'submitted_by', 'reviewed_by', 'reviewed_at', 'reject_reason', 'shop_subscription_id',
    ];

    protected $casts = ['amount' => 'decimal:2', 'periods' => 'integer', 'reviewed_at' => 'datetime'];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'reviewed_by');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(ShopSubscription::class, 'shop_subscription_id');
    }

    /** The uploaded receipt (private disk). */
    public function proof(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')->where('document_type', 'subscription_proof');
    }
}
