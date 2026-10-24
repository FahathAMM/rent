<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\VehiclePricing;
use Carbon\Carbon;

/**
 * Snapshots vehicle_pricing wholesale into an immutable booking_pricing
 * row at request time - see app-doc/marketplace/02-data-model.md
 * "booking_pricing" and 04-lifecycles.md "Commission model". An owner
 * editing rates tomorrow must never change what an already-requested
 * booking owes, so every number here is computed once and never
 * recalculated from the live vehicle_pricing row again.
 */
class BookingPricingCalculator
{
    public function quote(Vehicle $vehicle, VehiclePricing $pricing, Carbon $pickupAt, Carbon $returnAt, bool $withDriver, bool $deliveryRequested): array
    {
        $rentalDays = max(1, (int) ceil($pickupAt->diffInHours($returnAt) / 24));

        $baseAmount = round((float) $pricing->daily_rate * $rentalDays, 2);
        $driverAmount = $withDriver ? round((float) $pricing->driver_rate_per_day * $rentalDays, 2) : 0;
        $deliveryAmount = $deliveryRequested && $pricing->delivery_available
            ? round((float) ($pricing->delivery_flat_fee ?? 0), 2)
            : 0;

        $subtotal = $baseAmount + $driverAmount + $deliveryAmount;
        $taxAmount = round($subtotal * (float) $pricing->tax_rate / 100, 2);
        $securityDeposit = round((float) $pricing->security_deposit, 2);
        $totalPayable = round($subtotal + $taxAmount + $securityDeposit, 2);

        $snapshot = $pricing->only([
            'currency', 'daily_rate', 'weekly_rate', 'monthly_rate', 'weekend_surcharge_pct',
            'security_deposit', 'deposit_method', 'mileage_allowance_per_day_km', 'excess_mileage_rate_per_km',
            'driver_rate_per_day', 'delivery_available', 'delivery_flat_fee', 'tax_rate',
        ]);

        return [
            'rental_days' => $rentalDays,
            'pricing' => [
                'currency' => $pricing->currency,
                'pricing_snapshot' => $snapshot,
                'rate_plan' => 'daily',
                'rate_breakdown' => [['plan' => 'daily', 'units' => $rentalDays, 'rate' => (float) $pricing->daily_rate]],
                'base_amount' => $baseAmount,
                'extras_amount' => 0,
                'delivery_amount' => $deliveryAmount,
                'driver_amount' => $driverAmount,
                'weekend_surcharge_amount' => 0,
                'discount_amount' => 0,
                'subtotal' => $subtotal,
                'tax_rate' => $pricing->tax_rate,
                'tax_amount' => $taxAmount,
                'service_fee' => 0,
                'security_deposit' => $securityDeposit,
                'total_payable' => $totalPayable,
                'mileage_allowance_total_km' => $pricing->mileage_allowance_per_day_km ? $pricing->mileage_allowance_per_day_km * $rentalDays : null,
                'excess_mileage_rate_per_km' => $pricing->excess_mileage_rate_per_km,
                'computed_at' => now(),
                'computed_by' => 'system',
                'snapshot_hash' => hash('sha256', json_encode([$vehicle->id, $pricing->id, $pickupAt->toISOString(), $returnAt->toISOString(), $withDriver, $deliveryRequested, $totalPayable])),
            ],
        ];
    }
}
