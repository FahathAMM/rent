<?php

namespace App\Models;

use App\Models\Concerns\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A shop's branches and vehicle pickup/return points. */
class Location extends Model
{
    use HasFactory, BelongsToShop;

    protected $fillable = [
        'shop_id', 'name', 'type', 'branch_code', 'address', 'city', 'district', 'country',
        'latitude', 'longitude', 'phone', 'email', 'contact_person', 'working_hours',
        'notes', 'is_active',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'is_active' => 'boolean',
    ];

    public function vehiclePickupLocations(): HasMany
    {
        return $this->hasMany(VehiclePickupLocation::class);
    }
}
