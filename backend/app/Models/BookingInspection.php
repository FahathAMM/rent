<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Exactly one handover and one return inspection per booking (unique(booking_id, type)). */
class BookingInspection extends Model
{
    public const TYPE_HANDOVER = 'handover';
    public const TYPE_RETURN = 'return';

    protected $fillable = [
        'booking_id', 'type', 'odometer_reading', 'fuel_level',
        'exterior_checklist', 'interior_checklist', 'accessories_checklist',
        'notes', 'customer_present', 'customer_signature_path', 'conducted_by', 'conducted_at',
    ];

    protected $casts = [
        'exterior_checklist' => 'array',
        'interior_checklist' => 'array',
        'accessories_checklist' => 'array',
        'customer_present' => 'boolean',
        'conducted_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function conductedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conducted_by');
    }

    public function damages(): HasMany
    {
        return $this->hasMany(BookingDamage::class, 'inspection_id');
    }
}
