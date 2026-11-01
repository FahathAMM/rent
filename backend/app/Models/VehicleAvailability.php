<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per vehicle per date. unique(vehicle_id, date) is the hard
 * database-level backstop against double booking - see
 * app-doc/marketplace/04-lifecycles.md "Concurrency".
 */
class VehicleAvailability extends Model
{
    protected $table = 'vehicle_availability';

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_BLOCKED = 'blocked';
    public const STATUS_BOOKED = 'booked';
    public const STATUS_MAINTENANCE = 'maintenance';

    protected $fillable = ['vehicle_id', 'date', 'status', 'booking_id', 'note', 'created_by'];

    // A calendar day, not an instant - serialised as plain Y-m-d so clients can key on it without timezone shifts.
    protected $casts = ['date' => 'date:Y-m-d'];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
