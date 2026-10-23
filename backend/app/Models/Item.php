<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model
{
    use HasFactory, SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'name', 'sku', 'category', 'icon', 'unit_id',
        'purchase_price', 'selling_price', 'tax_rate', 'is_active', 'notes',
    ];

    protected $casts = [
        'purchase_price' => 'decimal:2',
        'selling_price'  => 'decimal:2',
        'tax_rate'       => 'decimal:2',
        'is_active'      => 'boolean',
    ];

    /**
     * purchase_price/selling_price above are the stable base rate. These
     * appended fields resolve today's ItemDailyPrice override on top of it,
     * so callers (POS, Purchases) never need to know the fallback exists.
     */
    protected $appends = [
        'today_purchase_price', 'today_selling_price',
        'effective_purchase_price', 'effective_selling_price',
    ];

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function purchaseItems(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function dailyPrices(): HasMany
    {
        return $this->hasMany(ItemDailyPrice::class);
    }

    public function todayPrice(): HasOne
    {
        return $this->hasOne(ItemDailyPrice::class)->whereDate('price_date', now()->toDateString());
    }

    public function getTodayPurchasePriceAttribute(): ?string
    {
        return $this->todayPrice?->purchase_price;
    }

    public function getTodaySellingPriceAttribute(): ?string
    {
        return $this->todayPrice?->selling_price;
    }

    public function getEffectivePurchasePriceAttribute(): ?string
    {
        return $this->todayPrice?->purchase_price ?? $this->purchase_price;
    }

    public function getEffectiveSellingPriceAttribute(): ?string
    {
        return $this->todayPrice?->selling_price ?? $this->selling_price;
    }
}
