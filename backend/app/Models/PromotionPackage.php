<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Something a shop can buy to be seen more: "featured" (a vehicle) or "sponsored" (the shop in a category / its city), for N days. */
class PromotionPackage extends Model
{
    protected $fillable = ['type', 'name', 'days', 'price', 'is_active', 'sort_order'];

    protected $casts = ['days' => 'integer', 'price' => 'decimal:2', 'is_active' => 'boolean', 'sort_order' => 'integer'];
}
