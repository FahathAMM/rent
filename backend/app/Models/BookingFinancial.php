<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The settlement view - what money actually moved. commission_rule_id and
 * payout_id are plain indexed columns, not hard FKs (see the migration),
 * so a commission rule or payout can be archived without disturbing a
 * booking that already froze its rate.
 */
class BookingFinancial extends Model
{
    protected $table = 'booking_financials';

    public const SETTLEMENT_NOT_ELIGIBLE = 'not_eligible';
    public const SETTLEMENT_UNSETTLED = 'unsettled';
    public const SETTLEMENT_IN_PAYOUT = 'in_payout';
    public const SETTLEMENT_PARTIALLY_PAID = 'partially_paid';
    public const SETTLEMENT_PAID = 'paid';
    public const SETTLEMENT_ON_HOLD = 'on_hold';

    protected $fillable = [
        'booking_id', 'currency',
        'customer_paid_amount', 'security_deposit_held',
        'gross_rental_amount', 'commissionable_amount', 'commission_rule_id', 'commission_rate',
        'commission_fixed', 'commission_amount', 'payment_processing_fee', 'processing_fee_borne_by',
        'tax_withheld', 'owner_payable_amount', 'platform_net_amount',
        'refunded_amount', 'deposit_returned_amount', 'deposit_forfeited_amount',
        'damage_charged_amount', 'adjustments_amount',
        'settlement_status', 'payout_id', 'eligible_for_payout_at',
    ];

    protected $casts = [
        'customer_paid_amount' => 'decimal:2',
        'security_deposit_held' => 'decimal:2',
        'gross_rental_amount' => 'decimal:2',
        'commissionable_amount' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'commission_fixed' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'payment_processing_fee' => 'decimal:2',
        'tax_withheld' => 'decimal:2',
        'owner_payable_amount' => 'decimal:2',
        'platform_net_amount' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'deposit_returned_amount' => 'decimal:2',
        'deposit_forfeited_amount' => 'decimal:2',
        'damage_charged_amount' => 'decimal:2',
        'adjustments_amount' => 'decimal:2',
        'eligible_for_payout_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
