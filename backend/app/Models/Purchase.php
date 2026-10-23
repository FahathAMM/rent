<?php

namespace App\Models;

use App\Models\Administration\User;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Purchase extends Model
{
    use HasFactory, SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'purchase_number', 'vendor_id', 'purchase_date', 'due_date', 'reference_no',
        'subtotal', 'discount_type', 'discount_value', 'discount_amount', 'tax_amount', 'total',
        'paid_amount', 'balance_amount', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'purchase_date'    => 'date',
        'due_date'         => 'date',
        'subtotal'         => 'decimal:2',
        'discount_value'   => 'decimal:2',
        'discount_amount'  => 'decimal:2',
        'tax_amount'       => 'decimal:2',
        'total'            => 'decimal:2',
        'paid_amount'      => 'decimal:2',
        'balance_amount'   => 'decimal:2',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PurchasePayment::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    /** Once money has moved against a purchase, its line items and totals are frozen. */
    public function hasPayments(): bool
    {
        return (float) $this->paid_amount > 0;
    }
}
