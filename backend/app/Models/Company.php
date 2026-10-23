<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'legal_name', 'email', 'phone', 'website', 'trn',
        'address_line_1', 'address_line_2', 'city', 'emirate', 'country',
        'currency', 'timezone', 'logo', 'status',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(CompanySetting::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** The subscription currently governing access (trial or active), if any. */
    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->whereIn('status', ['trial', 'active'])
            ->latestOfMany();
    }

    /** The company's most recent subscription regardless of status — used by the Platform area, which needs to show cancelled/expired plans too. */
    public function latestSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
