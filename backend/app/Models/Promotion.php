<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/**
 * A featured listing or a sponsorship — bought (receipt, approved by the
 * platform) or granted. Live while approved and starts_at <= now < ends_at;
 * see App\Services\PromotionService. Not shop-scoped (the platform reads all).
 */
class Promotion extends Model
{
    public const TYPE_FEATURED = 'featured';
    public const TYPE_SPONSORED = 'sponsored';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const KIND_PAID = 'paid';
    public const KIND_GRANTED = 'granted';

    protected $fillable = [
        'reference_no', 'shop_id', 'package_id', 'type', 'vehicle_id', 'city',
        'days', 'amount', 'kind', 'status', 'starts_at', 'ends_at', 'bank_reference', 'note',
        'submitted_by', 'reviewed_by', 'reviewed_at', 'reject_reason',
    ];

    protected $casts = [
        'days' => 'integer', 'amount' => 'decimal:2',
        'starts_at' => 'datetime', 'ends_at' => 'datetime', 'reviewed_at' => 'datetime',
    ];

    /** Approved and running right now. */
    public function scopeLive(Builder $query): Builder
    {
        return $query->where('promotions.status', self::STATUS_APPROVED)
            ->where('promotions.starts_at', '<=', now())
            ->where('promotions.ends_at', '>', now());
    }

    /** Approved and not yet over (running or scheduled to start later). */
    public function scopeBooked(Builder $query): Builder
    {
        return $query->where('promotions.status', self::STATUS_APPROVED)->where('promotions.ends_at', '>', now());
    }

    /** UI state: pending | scheduled | live | ended | rejected. */
    public function state(): string
    {
        return match (true) {
            $this->status === self::STATUS_PENDING => 'pending',
            $this->status === self::STATUS_REJECTED => 'rejected',
            $this->starts_at?->isFuture() => 'scheduled',
            $this->ends_at?->isFuture() => 'live',
            default => 'ended',
        };
    }

    /** "Toyota Aqua 2020" for featured, the city ("Kandy") for sponsored. */
    public function targetLabel(): string
    {
        return $this->type === self::TYPE_FEATURED
            ? ($this->vehicle?->title ?? 'Vehicle #' . $this->vehicle_id)
            : (string) $this->city;
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(PromotionPackage::class, 'package_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'reviewed_by');
    }

    /** The uploaded receipt (private disk). */
    public function proof(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')->where('document_type', 'promotion_proof');
    }
}
