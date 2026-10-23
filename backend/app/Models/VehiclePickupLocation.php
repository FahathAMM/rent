<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehiclePickupLocation extends Model
{
    protected $fillable = ['vehicle_id', 'location_id', 'is_default', 'delivery_allowed'];

    protected $casts = [
        'is_default' => 'boolean',
        'delivery_allowed' => 'boolean',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
