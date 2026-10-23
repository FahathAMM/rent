<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Commission rules. Resolution order at confirmation time: vehicle-scoped
 * > shop-scoped > category-scoped > global, highest priority first within
 * a tier - see app-doc/marketplace/04-lifecycles.md "Commission model".
 * The resolved rule's id/rate/amount are frozen into booking_financials;
 * editing or deleting a rule later never re-prices an existing booking.
 */
class PlatformCommission extends Model
{
    public const SCOPE_GLOBAL = 'global';
    public const SCOPE_CATEGORY = 'category';
    public const SCOPE_SHOP = 'shop';
    public const SCOPE_VEHICLE = 'vehicle';

    protected $fillable = [
        'name', 'scope_type', 'scope_id', 'percentage', 'fixed_amount', 'min_amount', 'max_amount',
        'applies_to', 'processing_fee_borne_by', 'priority', 'effective_from', 'effective_to',
        'is_active', 'notes', 'created_by',
    ];

    protected $casts = [
        'percentage' => 'decimal:2',
        'fixed_amount' => 'decimal:2',
        'min_amount' => 'decimal:2',
        'max_amount' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_active' => 'boolean',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'created_by');
    }

    public function isEffectiveOn(\DateTimeInterface $date): bool
    {
        if (!$this->is_active) {
            return false;
        }

        return $this->effective_from <= $date && (!$this->effective_to || $this->effective_to >= $date);
    }
}
