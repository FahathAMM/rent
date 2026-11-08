<?php

namespace App\Models;

use App\Models\Administration\User;
use App\Models\Concerns\BelongsToShop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A completed deal and its signed sale agreement. sale_price and the buyer's details are private to the shop. */
class VehicleSale extends Model
{
    use BelongsToShop;

    public const PAYMENT_METHODS = ['cash', 'bank_transfer', 'lease', 'other'];

    protected $fillable = [
        'reference', 'vehicle_id', 'shop_id', 'customer_id', 'enquiry_id',
        'buyer_name', 'buyer_phone', 'buyer_nic', 'buyer_address', 'sale_price', 'payment_method', 'sold_at',
        'terms_snapshot', 'buyer_signature_path', 'terms_accepted_at', 'recorded_by',
    ];

    protected $casts = [
        'buyer_nic' => 'encrypted',
        'sale_price' => 'decimal:2',
        'sold_at' => 'datetime',
        'terms_accepted_at' => 'datetime',
    ];

    protected $hidden = ['buyer_nic', 'terms_snapshot', 'buyer_signature_path'];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function enquiry(): BelongsTo
    {
        return $this->belongsTo(SaleEnquiry::class, 'enquiry_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
