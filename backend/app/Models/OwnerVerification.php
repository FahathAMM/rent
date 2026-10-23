<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OwnerVerification extends Model
{
    protected $fillable = [
        'owner_profile_id', 'document_type', 'attachment_id', 'status',
        'reviewed_by', 'reviewed_at', 'rejection_reason', 'expires_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'expires_at' => 'date',
    ];

    public function ownerProfile(): BelongsTo
    {
        return $this->belongsTo(OwnerProfile::class);
    }

    public function attachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'reviewed_by');
    }
}
