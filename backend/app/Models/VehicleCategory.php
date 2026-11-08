<?php

namespace App\Models;

use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VehicleCategory extends Model
{
    use HasTranslations;

    /** Columns with other-language text in `translations` (see HasTranslations). */
    protected array $translatable = ['name', 'description'];

    protected $fillable = [
        'parent_id', 'name', 'slug', 'icon', 'description',
        'sort_order', 'is_active', 'default_min_rental_days',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class, 'category_id');
    }
}
