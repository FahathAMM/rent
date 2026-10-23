<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** is_internal messages are visible to platform admins only. */
class DisputeMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['dispute_id', 'author_type', 'author_id', 'message', 'is_internal', 'attachment_id'];

    protected $casts = ['is_internal' => 'boolean'];

    public function dispute(): BelongsTo
    {
        return $this->belongsTo(Dispute::class);
    }

    public function attachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class);
    }
}
