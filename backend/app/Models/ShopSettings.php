<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopSettings extends Model
{
    protected $table = 'shop_settings';

    protected $fillable = [
        'shop_id',
        'booking_prefix', 'next_booking_number',
        'payout_prefix', 'next_payout_number',
        'agreement_prefix', 'next_agreement_number',
        'expense_prefix', 'next_expense_number',
        'branch_prefix', 'next_branch_number',
        'owner_response_hours', 'payment_window_hours', 'auto_accept_bookings', 'advance_notice_hours',
        'default_min_rental_days', 'default_max_rental_days', 'free_cancellation_hours', 'cancellation_tiers',
        'agreement_terms', 'invoice_footer',
    ];

    protected $casts = [
        'auto_accept_bookings' => 'boolean',
        'cancellation_tiers' => 'array',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    /**
     * Every ShopSettings row MUST be created through this, never a bare
     * ShopSettings::create(['shop_id' => $id]) - the migration's column
     * defaults ('BKG', 'PO', 'AGR', 'EXP', 'BR' for every shop) combined
     * with NumberGenerator's per-shop counter produce IDENTICAL formatted
     * strings across shops (e.g. two different shops both reach
     * "BKG-2026-00009"). That's fine for expenses (expense_number is
     * unique per (shop_id, expense_number)) but booking_reference and
     * payout_reference are GLOBALLY unique columns - see
     * app-doc/marketplace/02-data-model.md "bookings"/"owner_payouts" -
     * so a shared prefix collides the instant two shops' independent
     * counters reach the same number, which happens almost immediately.
     * Suffixing every prefix with the shop's own (globally unique) id
     * makes every formatted reference unique by construction, with no
     * uniqueness check needed.
     */
    public static function createFor(int $shopId): self
    {
        return self::create([
            'shop_id' => $shopId,
            'booking_prefix' => "BKG{$shopId}",
            'payout_prefix' => "PO{$shopId}",
            'agreement_prefix' => "AGR{$shopId}",
            'expense_prefix' => "EXP{$shopId}",
            'branch_prefix' => "BR{$shopId}",
        ]);
    }
}
