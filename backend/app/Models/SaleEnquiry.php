<?php

namespace App\Models;

use App\Models\Concerns\BelongsToShop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A buyer's conversation with a shop about one car. Shop-scoped like a booking,
 * so the customer side reads it only through App\Queries\CustomerSaleQuery.
 */
class SaleEnquiry extends Model
{
    use BelongsToShop;

    public const STATUS_NEW = 'new';
    public const STATUS_REPLIED = 'replied';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_DECLINED = 'declined';
    public const STATUS_CLOSED = 'closed';

    public const OPEN_STATUSES = [self::STATUS_NEW, self::STATUS_REPLIED];

    public const SENDER_CUSTOMER = 'customer';
    public const SENDER_SHOP = 'shop';

    protected $fillable = [
        'reference', 'vehicle_id', 'shop_id', 'customer_id', 'type', 'offer_amount',
        'status', 'last_message_at', 'closed_reason',
    ];

    protected $casts = [
        'offer_amount' => 'decimal:2',
        'last_message_at' => 'datetime',
    ];

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('sale_enquiries.status', self::OPEN_STATUSES);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SaleEnquiryMessage::class, 'enquiry_id');
    }

    /** The deal, when this enquiry became the sale. */
    public function sale(): HasOne
    {
        return $this->hasOne(VehicleSale::class, 'enquiry_id');
    }
}
