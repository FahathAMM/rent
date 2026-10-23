<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'slug', 'monthly_price', 'yearly_price',
        'max_users', 'max_customers', 'max_invoices', 'trial_days',
        'status', 'sort_order', 'disabled_modules',
    ];

    protected $casts = [
        'monthly_price'    => 'decimal:2',
        'yearly_price'     => 'decimal:2',
        'disabled_modules' => 'array',
    ];

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
