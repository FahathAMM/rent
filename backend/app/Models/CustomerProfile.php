<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerProfile extends Model
{
    protected $fillable = [
        'user_id', 'nic_number', 'driving_licence_no', 'licence_country',
        'licence_issued_on', 'licence_expiry', 'licence_classes',
        'address_line_1', 'address_line_2', 'city', 'district', 'postal_code',
        'emergency_contact_name', 'emergency_contact_phone',
        'verification_status', 'verified_at', 'verified_by',
    ];

    protected $casts = [
        'nic_number' => 'encrypted',
        'driving_licence_no' => 'encrypted',
        'licence_issued_on' => 'date',
        'licence_expiry' => 'date',
        'licence_classes' => 'array',
        'verified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'verified_by');
    }

    public function hasValidLicence(): bool
    {
        return $this->licence_expiry !== null && $this->licence_expiry->isFuture();
    }
}
