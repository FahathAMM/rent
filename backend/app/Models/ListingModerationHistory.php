<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only. */
class ListingModerationHistory extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'listing_moderation_history';

    protected $fillable = [
        'vehicle_id', 'from_status', 'to_status', 'action', 'actor_type', 'actor_id', 'reason', 'notes',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
