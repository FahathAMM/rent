<?php

namespace App\Models;

use App\Models\Administration\User;
use App\Models\Concerns\BelongsToShop;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * status and payment_status are two independent axes - see
 * app-doc/marketplace/04-lifecycles.md. Nothing should ever set either
 * column directly; both go through a TransitionBooking action (later
 * phase) that also writes a booking_status_histories row.
 *
 * shop_id is denormalised from vehicle.shop_id on purpose so BelongsToShop
 * (ShopScope) can filter without a join - see
 * app-doc/marketplace/01-phase1-architecture.md section 3.2.
 */
class Booking extends Model
{
    use HasFactory, BelongsToShop, SoftDeletes;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CANCELLED_BY_CUSTOMER = 'cancelled_by_customer';
    public const STATUS_CANCELLED_BY_OWNER = 'cancelled_by_owner';
    public const STATUS_CANCELLED_BY_ADMIN = 'cancelled_by_admin';
    public const STATUS_NO_SHOW = 'no_show';

    public const PAYMENT_UNPAID = 'unpaid';
    public const PAYMENT_INITIATED = 'initiated';
    public const PAYMENT_AUTHORIZED = 'authorized';
    public const PAYMENT_PARTIALLY_PAID = 'partially_paid';
    public const PAYMENT_PAID = 'paid';
    public const PAYMENT_REFUND_PENDING = 'refund_pending';
    public const PAYMENT_PARTIALLY_REFUNDED = 'partially_refunded';
    public const PAYMENT_REFUNDED = 'refunded';
    public const PAYMENT_FAILED = 'failed';

    protected $fillable = [
        'booking_reference', 'vehicle_id', 'shop_id', 'customer_id',
        'pickup_location_id', 'pickup_address', 'pickup_latitude', 'pickup_longitude',
        'return_location_id', 'return_address', 'delivery_requested', 'delivery_distance_km',
        'pickup_at', 'return_at', 'rental_days', 'actual_pickup_at', 'actual_return_at',
        'with_driver', 'driver_days',
        'status', 'payment_status', 'owner_response_deadline_at', 'payment_deadline_at',
        'accepted_at', 'decided_by', 'rejected_at', 'rejection_reason', 'confirmed_at',
        'cancelled_at', 'cancelled_by_type', 'cancelled_by_id', 'cancellation_reason',
        'completed_at', 'expired_at', 'expiry_reason',
        'customer_note', 'owner_note', 'internal_note',
        'has_open_dispute', 'review_eligible_until',
    ];

    protected $casts = [
        'pickup_at' => 'datetime',
        'return_at' => 'datetime',
        'actual_pickup_at' => 'datetime',
        'actual_return_at' => 'datetime',
        'with_driver' => 'boolean',
        'delivery_requested' => 'boolean',
        'owner_response_deadline_at' => 'datetime',
        'payment_deadline_at' => 'datetime',
        'accepted_at' => 'datetime',
        'rejected_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'completed_at' => 'datetime',
        'expired_at' => 'datetime',
        'has_open_dispute' => 'boolean',
        'review_eligible_until' => 'datetime',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function pickupLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'pickup_location_id');
    }

    public function returnLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'return_location_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function pricing(): HasOne
    {
        return $this->hasOne(BookingPricing::class);
    }

    public function financials(): HasOne
    {
        return $this->hasOne(BookingFinancial::class);
    }

    public function securityDeposit(): HasOne
    {
        return $this->hasOne(SecurityDeposit::class);
    }

    public function extras(): HasMany
    {
        return $this->hasMany(BookingExtra::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(BookingStatusHistory::class);
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(BookingInspection::class);
    }

    public function damages(): HasMany
    {
        return $this->hasMany(BookingDamage::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(Dispute::class);
    }

    public function isAwaitingPayment(): bool
    {
        return $this->status === self::STATUS_ACCEPTED
            && in_array($this->payment_status, [self::PAYMENT_UNPAID, self::PAYMENT_INITIATED, self::PAYMENT_FAILED], true);
    }
}
