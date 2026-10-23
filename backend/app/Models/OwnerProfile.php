<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class OwnerProfile extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_INFO_REQUESTED = 'info_requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'user_id', 'applicant_type', 'full_name', 'nic_number', 'date_of_birth',
        'contact_phone', 'alt_phone', 'address_line_1', 'address_line_2',
        'city', 'district', 'postal_code', 'latitude', 'longitude',
        'status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'rejection_reason',
        'info_requested_note', 'info_requested_at', 'approved_at',
        'suspended_at', 'suspension_reason', 'terms_accepted_at',
    ];

    protected $casts = [
        'nic_number' => 'encrypted',
        'date_of_birth' => 'date',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'info_requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'suspended_at' => 'datetime',
        'terms_accepted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'reviewed_by');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(OwnerVerification::class, 'owner_profile_id');
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
}
