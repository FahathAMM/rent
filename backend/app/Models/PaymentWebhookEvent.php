<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Inserting a row IS the idempotency check - unique(gateway, event_id).
 * A repeated webhook notification hits that unique key and the handler
 * does nothing further. See app-doc/marketplace/04-lifecycles.md.
 */
class PaymentWebhookEvent extends Model
{
    protected $fillable = [
        'gateway', 'event_id', 'event_type', 'signature_valid', 'payload', 'received_at',
        'status', 'processed_at', 'attempts', 'error', 'payment_id', 'ip',
    ];

    protected $casts = [
        'signature_valid' => 'boolean',
        'payload' => 'array',
        'received_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
