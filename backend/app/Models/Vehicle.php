<?php

namespace App\Models;

use App\Models\Administration\User;
use App\Models\Concerns\BelongsToShop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A vehicle becomes publicly visible only when status = published AND
 * moderation_status = approved AND its shop is active + is_published -
 * see app-doc/marketplace/01-phase1-architecture.md section 3.1. Public
 * reads never load this model directly with ->toArray(); they go through
 * App\Repositories\PublicVehicleRepo and a Public resource column allow-list
 * (later phase) so registration_number and other private fields can never
 * leak by being added here.
 */
class Vehicle extends Model
{
    use HasFactory, BelongsToShop, SoftDeletes;

    /** A vehicle is one or the other, never both — see app-doc/marketplace/13-vehicle-sales.md. */
    public const LISTING_RENT = 'rent';
    public const LISTING_SALE = 'sale';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_REVIEW = 'pending_review';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_UNPUBLISHED = 'unpublished';
    public const STATUS_ARCHIVED = 'archived';
    public const STATUS_REJECTED = 'rejected';

    public const MODERATION_PENDING = 'pending';
    public const MODERATION_APPROVED = 'approved';
    public const MODERATION_REJECTED = 'rejected';
    public const MODERATION_FLAGGED = 'flagged';

    protected $fillable = [
        'shop_id', 'listing_type', 'category_id', 'brand_id', 'model_id', 'variant_id', 'colour_id', 'created_by',
        'title', 'slug', 'make', 'model', 'year', 'variant', 'colour', 'registration_number',
        'transmission', 'fuel_type', 'engine_capacity_cc', 'seating_capacity', 'luggage_capacity',
        'doors', 'air_conditioned', 'features', 'description', 'condition_notes',
        'status', 'moderation_status', 'moderation_note', 'published_at', 'archived_at',
    ];

    protected $casts = [
        'features' => 'array',
        'air_conditioned' => 'boolean',
        'published_at' => 'datetime',
        'archived_at' => 'datetime',
        'rating_avg' => 'decimal:2',
        'last_booked_at' => 'datetime',
    ];

    private ?bool $featuredCache = null;

    public function scopeForRent(Builder $query): Builder
    {
        return $query->where('vehicles.listing_type', self::LISTING_RENT);
    }

    public function scopeForSale(Builder $query): Builder
    {
        return $query->where('vehicles.listing_type', self::LISTING_SALE);
    }

    public function isForSale(): bool
    {
        return $this->listing_type === self::LISTING_SALE;
    }

    /**
     * Featured right now (a live "featured" promotion). Search adds it as a column
     * (withExists in PublicVehicleRepo::searchQuery); otherwise it's looked up once.
     */
    public function getIsFeaturedAttribute($value): bool
    {
        if (array_key_exists('is_featured', $this->attributes)) {
            return (bool) $value;
        }

        // Cached on a property, not in $attributes — there is no is_featured column to save.
        return $this->featuredCache ??= Promotion::live()->where('type', Promotion::TYPE_FEATURED)->where('vehicle_id', $this->id)->exists();
    }

    /** Sponsored in the current search (only set by PublicVehicleRepo::searchQuery). */
    public function getIsSponsoredAttribute($value): bool
    {
        return (bool) $value;
    }

    /** Featured promotions of this vehicle. */
    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class, 'vehicle_id');
    }

    /** Promotions of the vehicle's shop (sponsorships) — matched on shop_id. */
    public function shopPromotions(): HasMany
    {
        return $this->hasMany(Promotion::class, 'shop_id', 'shop_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(VehicleCategory::class, 'category_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(VehicleBrand::class, 'brand_id');
    }

    public function vehicleModel(): BelongsTo
    {
        return $this->belongsTo(VehicleModel::class, 'model_id');
    }

    public function vehicleVariant(): BelongsTo
    {
        return $this->belongsTo(VehicleVariant::class, 'variant_id');
    }

    public function vehicleColour(): BelongsTo
    {
        return $this->belongsTo(VehicleColour::class, 'colour_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(VehicleImage::class)->orderBy('sort_order');
    }

    public function pricing(): HasOne
    {
        return $this->hasOne(VehiclePricing::class);
    }

    public function saleDetail(): HasOne
    {
        return $this->hasOne(VehicleSaleDetail::class);
    }

    public function pickupLocations(): HasMany
    {
        return $this->hasMany(VehiclePickupLocation::class);
    }

    public function availability(): HasMany
    {
        return $this->hasMany(VehicleAvailability::class);
    }

    public function moderationHistory(): HasMany
    {
        return $this->hasMany(ListingModerationHistory::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class)->where('status', 'published');
    }

    public function isPubliclyVisible(): bool
    {
        return $this->status === self::STATUS_PUBLISHED
            && $this->moderation_status === self::MODERATION_APPROVED;
    }
}
