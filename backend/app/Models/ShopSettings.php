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
}
