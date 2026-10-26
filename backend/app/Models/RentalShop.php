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

    /** Starter policy sections every new shop gets - the owner edits or removes them under Settings -> Shop Profile -> Policies. */
    public const DEFAULT_POLICIES = [
        ['title' => 'Pickup instructions', 'body' => 'Please bring your NIC/passport and driving licence for verification at pickup.'],
        ['title' => 'Return instructions', 'body' => 'Return the vehicle with the same fuel level as at pickup.'],
        ['title' => 'Rental terms', 'body' => 'Minimum rental age 21. Full-to-full fuel policy unless otherwise agreed.'],
        ['title' => 'Cancellation policy', 'body' => 'Free cancellation up to 48 hours before pickup.'],
    ];

    protected $fillable = [
        'owner_user_id', 'name', 'slug', 'description', 'tagline',
        'email', 'phone', 'whatsapp', 'website',
        'address_line_1', 'address_line_2', 'city', 'district', 'postal_code',
        'latitude', 'longitude', 'operating_hours',
        'policies',
        'logo', 'cover_image', 'business_registration_no', 'tax_id',
        'status', 'verification_status', 'is_published', 'published_at', 'suspended_reason',
        'verified_at', 'verified_by',
        'commission_rate_override', 'payout_schedule', 'min_payout_threshold',
    ];

    protected $appends = ['logo_url', 'cover_image_url'];

    protected $casts = [
        'operating_hours' => 'array',
        'policies' => 'array',
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

    /** Same-origin path - Next.js rewrites /storage/* to the backend (see PlatformDetailResource). */
    public function getLogoUrlAttribute(): ?string
    {
        return self::storageUrl($this->logo);
    }

    public function getCoverImageUrlAttribute(): ?string
    {
        return self::storageUrl($this->cover_image);
    }

    private static function storageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return str_starts_with($path, 'http') || str_starts_with($path, '/') ? $path : '/storage/' . $path;
    }

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
