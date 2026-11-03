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
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CANCELLED_BY_CUSTOMER = 'cancelled_by_customer';
    public const STATUS_CANCELLED_BY_OWNER = 'cancelled_by_owner';
    public const STATUS_CANCELLED_BY_ADMIN = 'cancelled_by_admin';
    public const STATUS_NO_SHOW = 'no_show';

    // What the shop has actually received (cash or verified transfers) against total_payable.
    public const PAYMENT_UNPAID = 'unpaid';
    public const PAYMENT_PARTIALLY_PAID = 'partially_paid';
    public const PAYMENT_PAID = 'paid';

    // Always paid to the shop directly - see app-doc/marketplace/09-online-payments-archive.md for the removed 'online' method.
    public const METHOD_CASH = 'cash';
    public const METHOD_BANK_TRANSFER = 'bank_transfer';

    protected $fillable = [
        'booking_reference', 'vehicle_id', 'shop_id', 'customer_id',
        'pickup_location_id', 'pickup_address', 'pickup_latitude', 'pickup_longitude',
        'return_location_id', 'return_address', 'delivery_requested', 'delivery_distance_km',
        'pickup_at', 'return_at', 'rental_days', 'actual_pickup_at', 'actual_return_at',
        'with_driver', 'driver_days',
        'status', 'payment_status', 'payment_method', 'owner_response_deadline_at',
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
        return $this->belongsTo(Customer::class, 'customer_id');
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

    /** Date changes made by the shop (TransitionBooking::reschedule()), newest first - shown to the customer and on the voucher. */
    public function dateChanges(): HasMany
    {
        return $this->hasMany(BookingStatusHistory::class)->where('field', 'dates')->latest('id');
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

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(Dispute::class);
    }

    /** Paid to the shop directly (cash at the counter or bank transfer) - the platform never holds this money. */
    public function isPaidToShop(): bool
    {
        return in_array($this->payment_method, [self::METHOD_CASH, self::METHOD_BANK_TRANSFER], true);
    }

    /**
     * Money the shop has actually received, net of anything paid back -
     * money lines only (cash / bank); the booking charge and price
     * adjustments are statement lines, not money. An uploaded but unverified
     * transfer does not count.
     */
    public function amountPaid(): float
    {
        $sum = $this->relationLoaded('payments')
            ? $this->payments->where('status', Payment::STATUS_SUCCEEDED)->whereNotNull('method')->sum(fn ($p) => (float) $p->credit - (float) $p->debit)
            : $this->payments()->money()->where('status', Payment::STATUS_SUCCEEDED)->selectRaw('COALESCE(SUM(credit - debit), 0) as net')->value('net');

        return round((float) $sum, 2);
    }

    /**
     * Still owed: what was payable, adjusted by how the deposit was settled at
     * return (the deposit charge closed, any part kept for damage), less the
     * money received net of anything handed back. Before a return there are no
     * settlement lines, so this is simply total_payable − paid.
     */
    public function balanceDue(): float
    {
        $settlement = $this->relationLoaded('payments')
            ? $this->payments->where('status', Payment::STATUS_SUCCEEDED)->whereIn('type', [Payment::TYPE_DAMAGE, Payment::TYPE_DEPOSIT_RELEASE])
                ->sum(fn ($p) => (float) $p->debit - (float) $p->credit)
            : (float) $this->payments()->where('status', Payment::STATUS_SUCCEEDED)->whereIn('type', [Payment::TYPE_DAMAGE, Payment::TYPE_DEPOSIT_RELEASE])
                ->selectRaw('COALESCE(SUM(debit - credit), 0) as net')->value('net');

        return max(0, round((float) ($this->pricing?->total_payable ?? 0) + $settlement - $this->amountPaid(), 2));
    }
}
