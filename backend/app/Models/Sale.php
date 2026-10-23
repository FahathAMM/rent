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

class Sale extends Model
{
    use HasFactory, SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'sale_number', 'customer_id', 'walk_in_name', 'sale_date', 'due_date', 'reference_no',
        'subtotal', 'discount_type', 'discount_value', 'discount_amount', 'tax_amount', 'total',
        'paid_amount', 'balance_amount', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'sale_date'        => 'date',
        'due_date'         => 'date',
        'subtotal'         => 'decimal:2',
        'discount_value'   => 'decimal:2',
        'discount_amount'  => 'decimal:2',
        'tax_amount'       => 'decimal:2',
        'total'            => 'decimal:2',
        'paid_amount'      => 'decimal:2',
        'balance_amount'   => 'decimal:2',
    ];

    protected $appends = ['customer_name'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    /** Who the receipt/invoice is made out to — the linked customer, or the free-text walk-in name. */
    public function getCustomerNameAttribute(): string
    {
        return $this->customer?->name ?? $this->walk_in_name ?? 'Walk-in Customer';
    }

    /** Once money has moved against a sale, its line items and totals are frozen. */
    public function hasPayments(): bool
    {
        return (float) $this->paid_amount > 0;
    }
}
