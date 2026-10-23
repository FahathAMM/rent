<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItemDailyPrice extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'item_id', 'price_date', 'purchase_price', 'selling_price',
    ];

    protected $casts = [
        'price_date'     => 'date',
        'purchase_price' => 'decimal:2',
        'selling_price'  => 'decimal:2',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
