<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Rewritten far more often than vehicle specs, so kept separate from
 * `vehicles`. booking_pricing snapshots this row wholesale at request
 * time, so an owner editing rates tomorrow never changes what an existing
 * booking owes.
 */
class VehiclePricing extends Model
{
    protected $table = 'vehicle_pricing';

    protected $fillable = [
        'vehicle_id', 'currency', 'daily_rate', 'weekly_rate', 'monthly_rate', 'weekend_surcharge_pct',
        'security_deposit', 'deposit_method', 'mileage_allowance_per_day_km', 'excess_mileage_rate_per_km',
        'driver_rate_per_day', 'delivery_available', 'delivery_free_radius_km', 'delivery_fee_per_km',
        'delivery_flat_fee', 'cleaning_fee', 'late_return_fee_per_hour', 'fuel_policy',
        'min_rental_days', 'max_rental_days', 'advance_notice_hours', 'tax_rate', 'updated_by',
    ];

    protected $casts = [
        'daily_rate' => 'decimal:2',
        'weekly_rate' => 'decimal:2',
        'monthly_rate' => 'decimal:2',
        'weekend_surcharge_pct' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'excess_mileage_rate_per_km' => 'decimal:2',
        'driver_rate_per_day' => 'decimal:2',
        'delivery_available' => 'boolean',
        'delivery_free_radius_km' => 'decimal:2',
        'delivery_fee_per_km' => 'decimal:2',
        'delivery_flat_fee' => 'decimal:2',
        'cleaning_fee' => 'decimal:2',
        'late_return_fee_per_hour' => 'decimal:2',
        'tax_rate' => 'decimal:2',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
