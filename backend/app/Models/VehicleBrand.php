<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VehicleBrand extends Model
{
    protected $fillable = ['name', 'slug', 'logo', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $appends = ['logo_url'];

    /** Same-origin path - Next.js rewrites /storage/* to the backend (see PlatformDetailResource). */
    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo ? '/storage/' . $this->logo : null;
    }

    public function models(): HasMany
    {
        return $this->hasMany(VehicleModel::class, 'brand_id');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class, 'brand_id');
    }
}
