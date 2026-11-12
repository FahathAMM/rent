<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** One of the platform's own costs — see /platform/accounts. Not shop-scoped: shops never see these. */
class PlatformExpense extends Model
{
    use SoftDeletes;

    public const CATEGORIES = [
        'hosting', 'domain', 'software', 'sms_email', 'marketing', 'salaries',
        'office', 'legal', 'bank_charges', 'tax', 'other',
    ];

    public const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'other'];

    protected $fillable = [
        'expense_number', 'expense_date', 'category', 'paid_to', 'description',
        'amount', 'payment_method', 'reference_no', 'notes', 'created_by',
    ];

    protected $casts = [
        'expense_date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'created_by');
    }
}
