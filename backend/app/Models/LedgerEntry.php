<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only financial ledger - the complete auditable transaction
 * history. No update or delete path is ever exposed; corrections are new
 * reversing entries, never edits to an existing row.
 */
class LedgerEntry extends Model
{
    public const UPDATED_AT = null;

    public const ACCOUNT_CUSTOMER_RECEIVABLE = 'customer_receivable';
    public const ACCOUNT_PLATFORM_CASH = 'platform_cash';
    public const ACCOUNT_GATEWAY_FEES = 'gateway_fees';
    public const ACCOUNT_COMMISSION_INCOME = 'commission_income';
    public const ACCOUNT_OWNER_PAYABLE = 'owner_payable';
    public const ACCOUNT_DEPOSIT_LIABILITY = 'deposit_liability';
    public const ACCOUNT_REFUNDS_PAYABLE = 'refunds_payable';
    public const ACCOUNT_TAX_PAYABLE = 'tax_payable';
    public const ACCOUNT_DAMAGE_RECOVERY = 'damage_recovery';
    public const ACCOUNT_ADJUSTMENTS = 'adjustments';

    public const DEBIT = 'debit';
    public const CREDIT = 'credit';

    protected $fillable = [
        'entry_date', 'account', 'direction', 'amount', 'currency',
        'booking_id', 'shop_id', 'payout_id', 'payment_id', 'refund_id',
        'source_type', 'source_id', 'memo', 'batch_id',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
