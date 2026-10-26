<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A registered rental business - the only kind of vendor workspace. Every
 * vehicle belongs to exactly one row here - see
 * app-doc/marketplace/01-phase1-architecture.md section 3.1.
 *
 * Deliberately has no BelongsToShop - a shop does not belong to itself.
 */
class RentalShop extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_REVIEW = 'pending_review';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_REJECTED = 'rejected';

    public const VERIFICATION_UNVERIFIED = 'unverified';
    public const VERIFICATION_PENDING = 'pending';
    public const VERIFICATION_VERIFIED = 'verified';
    public const VERIFICATION_REJECTED = 'rejected';

    protected $fillable = [
        'owner_user_id', 'name', 'slug', 'description', 'tagline',
        'email', 'phone', 'whatsapp', 'website',
        'address_line_1', 'address_line_2', 'city', 'district', 'postal_code',
        'latitude', 'longitude', 'operating_hours',
        'pickup_instructions', 'return_instructions', 'rental_terms', 'cancellation_policy',
        'logo', 'cover_image', 'business_registration_no', 'tax_id',
        'status', 'verification_status', 'is_published', 'published_at', 'suspended_reason',
        'verified_at', 'verified_by',
        'commission_rate_override', 'payout_schedule', 'min_payout_threshold',
    ];

    protected $casts = [
        'operating_hours' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
        'verified_at' => 'datetime',
        'commission_rate_override' => 'decimal:2',
        'min_payout_threshold' => 'decimal:2',
        'rating_avg' => 'decimal:2',
        'response_rate' => 'decimal:2',
        'tax_id' => 'encrypted',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function settings(): HasOne
    {
        return $this->hasOne(ShopSettings::class, 'shop_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ShopMember::class, 'shop_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(ShopVerification::class, 'shop_id');
    }

    public function bankDetails(): HasMany
    {
        return $this->hasMany(OwnerBankDetail::class, 'shop_id');
    }

    public function primaryBankDetail(): HasOne
    {
        return $this->hasOne(OwnerBankDetail::class, 'shop_id')->where('is_primary', true);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class, 'shop_id');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class, 'shop_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'shop_id');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(OwnerPayout::class, 'shop_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isVerified(): bool
    {
        return $this->verification_status === self::VERIFICATION_VERIFIED;
    }
}
