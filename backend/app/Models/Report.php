<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Abuse / fraud reporting against any reportable entity. */
class Report extends Model
{
    protected $table = 'reports';

    protected $fillable = [
        'reportable_type', 'reportable_id', 'reported_by_user_id', 'reporter_email',
        'reason', 'description', 'status', 'reviewed_by', 'reviewed_at', 'action_taken', 'internal_note',
    ];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function reportable(): MorphTo
    {
        return $this->morphTo();
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_user_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'reviewed_by');
    }
}
