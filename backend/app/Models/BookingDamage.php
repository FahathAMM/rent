<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingDamage extends Model
{
    protected $fillable = [
        'booking_id', 'inspection_id', 'area', 'description', 'severity',
        'estimated_cost', 'charged_amount', 'status', 'reported_by',
        'resolved_by', 'resolved_at', 'resolution_note',
    ];

    protected $casts = [
        'estimated_cost' => 'decimal:2',
        'charged_amount' => 'decimal:2',
        'resolved_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(BookingInspection::class, 'inspection_id');
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
