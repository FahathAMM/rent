<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\VehiclePricing;
use Carbon\Carbon;

/**
 * Snapshots vehicle_pricing wholesale into an immutable booking_pricing
 * row at request time - see app-doc/marketplace/02-data-model.md
 * "booking_pricing". An owner
 * editing rates tomorrow must never change what an already-requested
 * booking owes, so every number here is computed once and never
 * recalculated from the live vehicle_pricing row again.
 */
class BookingPricingCalculator
{
    public function quote(Vehicle $vehicle, VehiclePricing $pricing, Carbon $pickupAt, Carbon $returnAt, bool $withDriver, bool $deliveryRequested): array
    {
        $rentalDays = max(1, (int) ceil($pickupAt->diffInHours($returnAt) / 24));

        $rateBreakdown = $this->rateBreakdown($pricing, $rentalDays);
        $baseAmount = round(array_sum(array_map(fn ($line) => $line['units'] * $line['rate'], $rateBreakdown)), 2);
        $plans = array_unique(array_column($rateBreakdown, 'plan'));
        $ratePlan = count($plans) === 1 ? $plans[0] : 'mixed';
        $driverAmount = $withDriver ? round((float) $pricing->driver_rate_per_day * $rentalDays, 2) : 0;
        $deliveryAmount = $deliveryRequested && $pricing->delivery_available
            ? round((float) ($pricing->delivery_flat_fee ?? 0), 2)
            : 0;

        $subtotal = $baseAmount + $driverAmount + $deliveryAmount;
        $taxAmount = round($subtotal * (float) $pricing->tax_rate / 100, 2);
        $securityDeposit = round((float) $pricing->security_deposit, 2);

        // total_payable is everything the customer pays the shop (cash and/or
        // bank transfer): rental + tax + the security deposit, unless the
        // vehicle's deposit is waived. The deposit is handed back at return.
        $depositCollectedNow = $pricing->deposit_method !== 'waived' ? $securityDeposit : 0;
        $totalPayable = round($subtotal + $taxAmount + $depositCollectedNow, 2);

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
                'rate_plan' => $ratePlan,
                'rate_breakdown' => $rateBreakdown,
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

    /**
     * Whole 30-day months at the monthly rate, then whole 7-day weeks at the
     * weekly rate, then leftover days at the daily rate. A missing (or zero)
     * weekly/monthly rate falls back to the daily rate for those days.
     * e.g. 40 days = 1 month + 1 week + 3 days.
     */
    private function rateBreakdown(VehiclePricing $pricing, int $rentalDays): array
    {
        $daily = (float) $pricing->daily_rate;
        $weekly = (float) $pricing->weekly_rate;
        $monthly = (float) $pricing->monthly_rate;

        $remaining = $rentalDays;
        $lines = [];

        if ($monthly > 0 && $remaining >= 30) {
            $lines[] = ['plan' => 'monthly', 'units' => intdiv($remaining, 30), 'rate' => $monthly];
            $remaining %= 30;
        }
        if ($weekly > 0 && $remaining >= 7) {
            $lines[] = ['plan' => 'weekly', 'units' => intdiv($remaining, 7), 'rate' => $weekly];
            $remaining %= 7;
        }
        if ($remaining > 0) {
            $lines[] = ['plan' => 'daily', 'units' => $remaining, 'rate' => $daily];
        }

        return $lines;
    }
}
