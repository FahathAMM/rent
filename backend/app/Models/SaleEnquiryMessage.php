<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleEnquiryMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['enquiry_id', 'sender_type', 'sender_id', 'body', 'offer_amount', 'read_at'];

    protected $casts = [
        'offer_amount' => 'decimal:2',
        'read_at' => 'datetime',
    ];

    public function enquiry(): BelongsTo
    {
        return $this->belongsTo(SaleEnquiry::class, 'enquiry_id');
    }
}
