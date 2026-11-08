<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The sale-only half of a `sale` vehicle (1:1). No BelongsToShop: like
 * VehiclePricing it is only reached through its vehicle, which is scoped,
 * and it has to load on public and customer reads, where ShopScope would
 * fail closed. shop_id is here for reporting.
 */
class VehicleSaleDetail extends Model
{
    public const STATUS_AVAILABLE = 'available';
    public const STATUS_RESERVED = 'reserved';
    public const STATUS_SOLD = 'sold';
    public const STATUS_WITHDRAWN = 'withdrawn';

    public const CONDITIONS = ['brand_new', 'reconditioned', 'used'];

    /** What the shop may set on a listing; the rest is managed by the sale flow. */
    public const EDITABLE = ['price', 'is_negotiable', 'mileage_km', 'condition', 'owners_count', 'warranty_months'];

    protected $primaryKey = 'vehicle_id';
    public $incrementing = false;

    protected $fillable = [
        'vehicle_id', 'shop_id', 'price', 'currency', 'is_negotiable', 'mileage_km', 'condition',
        'owners_count', 'warranty_months', 'sale_status', 'reserved_until',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_negotiable' => 'boolean',
        'mileage_km' => 'integer',
        'owners_count' => 'integer',
        'warranty_months' => 'integer',
        'reserved_until' => 'datetime',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function isSold(): bool
    {
        return $this->sale_status === self::STATUS_SOLD;
    }
}
