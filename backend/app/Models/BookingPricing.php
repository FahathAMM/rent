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
    // The table has neither created_at nor updated_at - only computed_at,
    // set explicitly at creation.
    public $timestamps = false;

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

    /**
     * Line-by-line price for the breakdown popup (month / week / day lines,
     * extras, tax, deposit, the quoted rates). Takes a booking_pricing row as
     * an array, or a BookingPricingCalculator quote's 'pricing'.
     */
    public static function breakdownFrom(array $p): array
    {
        $snapshot = $p['pricing_snapshot'] ?? [];
        $rate = fn (string $key) => isset($snapshot[$key]) ? (float) $snapshot[$key] : null;

        return [
            'rate_plan' => $p['rate_plan'] ?? 'daily',
            'rate_breakdown' => $p['rate_breakdown'] ?? [],
            'base_amount' => (float) ($p['base_amount'] ?? 0),
            'driver_amount' => (float) ($p['driver_amount'] ?? 0),
            'delivery_amount' => (float) ($p['delivery_amount'] ?? 0),
            'subtotal' => (float) ($p['subtotal'] ?? 0),
            'tax_rate' => (float) ($p['tax_rate'] ?? 0),
            'tax_amount' => (float) ($p['tax_amount'] ?? 0),
            'security_deposit' => (float) ($p['security_deposit'] ?? 0),
            'total_payable' => (float) ($p['total_payable'] ?? 0),
            'deposit_method' => $snapshot['deposit_method'] ?? null,
            'daily_rate' => (float) ($rate('daily_rate') ?? 0),
            'weekly_rate' => $rate('weekly_rate'),
            'monthly_rate' => $rate('monthly_rate'),
            'driver_rate_per_day' => (float) ($rate('driver_rate_per_day') ?? 0),
        ];
    }

    public function breakdown(): array
    {
        return self::breakdownFrom($this->toArray());
    }
}
