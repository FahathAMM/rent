<?php

namespace App\Support;

use App\Models\ShopSettings;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Generates sequential document numbers (bookings, payouts, agreements,
 * expenses) safely under concurrent requests by locking the shop's
 * settings row for the duration of the increment.
 *
 * Never generate numbers on the frontend - always call this from the
 * server-side action/service that creates the record, inside the same
 * DB::transaction() as the insert.
 */
final class NumberGenerator
{
    private const TYPES = [
        'booking'   => ['booking_prefix', 'next_booking_number', true, 5],
        'payout'    => ['payout_prefix', 'next_payout_number', true, 5],
        'agreement' => ['agreement_prefix', 'next_agreement_number', true, 5],
        'expense'   => ['expense_prefix', 'next_expense_number', true, 5],
        'branch'    => ['branch_prefix', 'next_branch_number', false, 3],
    ];

    public static function next(int $shopId, string $type): string
    {
        if (!isset(self::TYPES[$type])) {
            throw new InvalidArgumentException("Unknown document type [{$type}].");
        }

        [$prefixField, $counterField, $withYear, $padLength] = self::TYPES[$type];

        return DB::transaction(function () use ($shopId, $prefixField, $counterField, $withYear, $padLength) {
            $settings = ShopSettings::where('shop_id', $shopId)->lockForUpdate()->firstOrFail();

            $number = $settings->{$counterField};
            $prefix = $settings->{$prefixField};

            $settings->{$counterField} = $number + 1;
            $settings->save();

            $padded = str_pad((string) $number, $padLength, '0', STR_PAD_LEFT);

            return $withYear
                ? sprintf('%s-%s-%s', $prefix, now()->format('Y'), $padded)
                : sprintf('%s-%s', $prefix, $padded);
        });
    }
}
