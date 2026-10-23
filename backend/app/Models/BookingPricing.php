<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable quote snapshot - written once at request time, never updated.
 * There is deliberately no update path; a re-quote creates a new booking.
 */
class BookingPricing extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'booking_pricing';

    protected $fillable = [
        'booking_id', 'currency', 'pricing_snapshot', 'rate_plan', 'rate_breakdown',
        'base_amount', 'extras_amount', 'delivery_amount', 'driver_amount', 'weekend_surcharge_amount',
        'discount_code', 'discount_amount', 'subtotal', 'tax_rate', 'tax_amount', 'service_fee',
        'security_deposit', 'total_payable', 'mileage_allowance_total_km', 'excess_mileage_rate_per_km',
        'computed_at', 'computed_by', 'snapshot_hash',
    ];

    protected $casts = [
        'pricing_snapshot' => 'array',
        'rate_breakdown' => 'array',
        'base_amount' => 'decimal:2',
        'extras_amount' => 'decimal:2',
        'delivery_amount' => 'decimal:2',
        'driver_amount' => 'decimal:2',
        'weekend_surcharge_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'service_fee' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'total_payable' => 'decimal:2',
        'excess_mileage_rate_per_km' => 'decimal:2',
        'computed_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
