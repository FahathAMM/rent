<?php

namespace App\Support;

use App\Models\CompanySetting;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Generates sequential document numbers (customer codes, quotation/invoice/
 * payment/expense numbers) safely under concurrent requests by locking the
 * company's settings row for the duration of the increment.
 *
 * Never generate numbers on the frontend — always call this from the
 * server-side action/service that creates the record, inside the same
 * DB::transaction() as the insert.
 */
final class NumberGenerator
{
    private const TYPES = [
        'invoice'   => ['invoice_prefix', 'next_invoice_number', true, 5],
        'expense'   => ['expense_prefix', 'next_expense_number', true, 5],
        'branch'    => ['branch_prefix', 'next_branch_number', false, 3],
        'purchase'  => ['purchase_prefix', 'next_purchase_number', true, 5],
    ];

    public static function next(int $companyId, string $type): string
    {
        if (!isset(self::TYPES[$type])) {
            throw new InvalidArgumentException("Unknown document type [{$type}].");
        }

        [$prefixField, $counterField, $withYear, $padLength] = self::TYPES[$type];

        return DB::transaction(function () use ($companyId, $prefixField, $counterField, $withYear, $padLength) {
            $settings = CompanySetting::where('company_id', $companyId)->lockForUpdate()->firstOrFail();

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
