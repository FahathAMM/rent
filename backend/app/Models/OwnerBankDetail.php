<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * account_number is encrypted at rest. No resource/endpoint should ever
 * expose it - only account_number_last4 is meant for display.
 */
class OwnerBankDetail extends Model
{
    use SoftDeletes;

    protected $table = 'owner_bank_details';

    protected $fillable = [
        'shop_id', 'account_holder_name', 'bank_name', 'bank_code',
        'branch_name', 'branch_code', 'account_number', 'account_number_last4',
        'account_type', 'is_primary', 'verification_status', 'verified_by', 'verified_at',
    ];

    protected $hidden = ['account_number'];

    protected $casts = [
        'account_number' => 'encrypted',
        'is_primary' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'verified_by');
    }
}
