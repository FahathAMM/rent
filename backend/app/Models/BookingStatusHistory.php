<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only. Written by TransitionBooking (later phase) only. */
class BookingStatusHistory extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['booking_id', 'field', 'from_value', 'to_value', 'actor_type', 'actor_id', 'reason', 'meta'];

    protected $casts = ['meta' => 'array'];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
