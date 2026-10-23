<?php

namespace App\Support;

/**
 * Computes purchase line and header totals server-side — the frontend
 * sends quantity/price/discount/tax inputs, never totals.
 *
 * Every line is fully self-contained (its own discount, its own tax).
 * The header may apply one additional discount on top of the line
 * discounts; header tax is then the header's taxable amount times the
 * document's effective (line-weighted-average) tax rate, so a header
 * discount doesn't silently return money that tax was already charged on.
 *
 * All amounts are rounded to 2dp at every step (DECIMAL(12,2) columns) —
 * intermediate PHP floats never accumulate into a stored value unrounded.
 */
final class DocumentTotals
{
    /**
     * @return array{subtotal: float, discount_amount: float, taxable_amount: float, tax_amount: float, total: float}
     */
    public static function line(float $qty, float $unitPrice, ?string $discountType, float $discountValue, float $taxRate): array
    {
        $subtotal = round($qty * $unitPrice, 2);
        $discountAmount = self::discountAmount($discountType, $discountValue, $subtotal);
        $taxableAmount = round($subtotal - $discountAmount, 2);
        $taxAmount = round($taxableAmount * $taxRate / 100, 2);
        $total = round($taxableAmount + $taxAmount, 2);

        return [
            'subtotal'        => $subtotal,
            'discount_amount' => $discountAmount,
            'taxable_amount'  => $taxableAmount,
            'tax_amount'      => $taxAmount,
            'total'           => $total,
        ];
    }

    /**
     * @param array<int, array{subtotal: float, discount_amount: float, taxable_amount: float, tax_amount: float}> $lines
     * @return array{subtotal: float, discount_amount: float, taxable_amount: float, tax_amount: float, total: float}
     */
    public static function header(array $lines, ?string $discountType, float $discountValue): array
    {
        $subtotal = round(array_sum(array_column($lines, 'subtotal')), 2);
        $lineDiscounts = round(array_sum(array_column($lines, 'discount_amount')), 2);
        $lineTaxable = round(array_sum(array_column($lines, 'taxable_amount')), 2);
        $lineTax = round(array_sum(array_column($lines, 'tax_amount')), 2);

        $extraDiscount = self::discountAmount($discountType, $discountValue, $lineTaxable);
        $discountAmount = round($lineDiscounts + $extraDiscount, 2);
        $taxableAmount = round($lineTaxable - $extraDiscount, 2);

        $effectiveRate = $lineTaxable > 0 ? $lineTax / $lineTaxable : 0;
        $taxAmount = round($taxableAmount * $effectiveRate, 2);
        $total = round($taxableAmount + $taxAmount, 2);

        return [
            'subtotal'        => $subtotal,
            'discount_amount' => $discountAmount,
            'taxable_amount'  => $taxableAmount,
            'tax_amount'      => $taxAmount,
            'total'           => $total,
        ];
    }

    private static function discountAmount(?string $type, float $value, float $base): float
    {
        if (!$type || $value <= 0 || $base <= 0) {
            return 0.0;
        }

        return $type === 'percentage'
            ? round($base * $value / 100, 2)
            : round(min($value, $base), 2);
    }
}
