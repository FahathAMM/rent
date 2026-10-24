<?php

namespace App\Services;

use App\Models\PlatformCommission;
use App\Models\Vehicle;
use Carbon\Carbon;

/**
 * Rule resolution — most specific wins: vehicle-scoped > shop-scoped >
 * category-scoped > global, highest priority then latest effective_from
 * within a tier — see app-doc/marketplace/04-lifecycles.md "Commission
 * model". The rule must be active and inside its effective window AT THE
 * MOMENT the booking confirms; the caller freezes the winning rule's id/
 * rate/computed amount into booking_financials, so editing or deleting a
 * rule tomorrow never re-prices a booking that already exists.
 */
class CommissionResolver
{
    public function resolveFor(Vehicle $vehicle, ?Carbon $at = null): ?PlatformCommission
    {
        $at = $at ?? now();

        $tiers = [
            [PlatformCommission::SCOPE_VEHICLE, $vehicle->id],
            [PlatformCommission::SCOPE_SHOP, $vehicle->shop_id],
            [PlatformCommission::SCOPE_CATEGORY, $vehicle->category_id],
            [PlatformCommission::SCOPE_GLOBAL, null],
        ];

        foreach ($tiers as [$scopeType, $scopeId]) {
            $rule = PlatformCommission::where('scope_type', $scopeType)
                ->when($scopeId !== null, fn ($q) => $q->where('scope_id', $scopeId), fn ($q) => $q->whereNull('scope_id'))
                ->where('is_active', true)
                ->where('effective_from', '<=', $at->toDateString())
                ->where(fn ($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $at->toDateString()))
                ->orderByDesc('priority')
                ->orderByDesc('effective_from')
                ->first();

            if ($rule) {
                return $rule;
            }
        }

        return null;
    }

    /**
     * @return array{commissionable: float, commission: float, gateway_fee_borne_by_platform: bool}
     */
    public function compute(PlatformCommission $rule, float $baseAmount, float $extrasAmount, float $deliveryAmount, float $driverAmount): array
    {
        $commissionable = $rule->applies_to === 'rental_plus_extras'
            ? $baseAmount + $extrasAmount + $deliveryAmount + $driverAmount
            : $baseAmount;

        $commission = round($commissionable * (float) $rule->percentage / 100, 2) + (float) $rule->fixed_amount;

        if ($rule->min_amount !== null) {
            $commission = max($commission, (float) $rule->min_amount);
        }
        if ($rule->max_amount !== null) {
            $commission = min($commission, (float) $rule->max_amount);
        }

        return [
            'commissionable' => round($commissionable, 2),
            'commission' => round($commission, 2),
        ];
    }
}
