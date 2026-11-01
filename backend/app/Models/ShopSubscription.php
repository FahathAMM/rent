<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One trial, paid period or admin grant of a plan for a shop. See App\Services\SubscriptionService. */
class ShopSubscription extends Model
{
    public const KIND_TRIAL = 'trial';
    public const KIND_PAID = 'paid';
    public const KIND_GRANTED = 'granted';

    protected $fillable = ['shop_id', 'plan_id', 'kind', 'starts_at', 'ends_at', 'note', 'created_by'];

    protected $casts = ['starts_at' => 'datetime', 'ends_at' => 'datetime'];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'created_by');
    }
}
