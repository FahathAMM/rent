<?php

namespace App\Models\Administration;

use App\Helpers\Media;
use App\Models\Booking;
use App\Models\CustomerProfile;
use App\Models\Favorite;
use App\Models\OwnerProfile;
use App\Models\RentalShop;
use App\Models\ShopMember;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * A marketplace account - customer, owner, shop staff or any combination.
 * There is deliberately no company_id/shop_id column and no special-cased
 * "super-admin bypasses everything" role here (the old chicken-shop app
 * had that, confusingly duplicating what the separate SystemAdmin/
 * `platform` guard already does - see app-doc/marketplace/03-permissions-
 * model.md "Layer 0"). Platform admin powers live exclusively in
 * SystemAdmin; a marketplace user's roles (customer, vehicle-owner,
 * shop-owner, shop-staff) are additive and never grant platform access.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, Media, SoftDeletes;

    protected string $guard_name = 'web';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_BANNED = 'banned';

    protected $fillable = [
        'name', 'email', 'password', 'phone', 'phone_country', 'avatar',
        'date_of_birth', 'address', 'status', 'suspended_reason', 'suspended_at',
        'last_login_at', 'registration_source',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'phone_verified_at' => 'datetime',
        'password' => 'hashed',
        'date_of_birth' => 'date',
        'suspended_at' => 'datetime',
        'last_login_at' => 'datetime',
    ];

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function ownerProfile(): HasOne
    {
        return $this->hasOne(OwnerProfile::class);
    }

    public function customerProfile(): HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function shopMemberships(): HasMany
    {
        return $this->hasMany(ShopMember::class, 'user_id');
    }

    /** Memberships this user can currently act under - excludes invited/suspended/revoked rows. */
    public function activeShopMemberships(): HasMany
    {
        return $this->shopMemberships()->where('status', ShopMember::STATUS_ACTIVE);
    }

    public function ownedShops(): HasMany
    {
        return $this->hasMany(RentalShop::class, 'owner_user_id');
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'customer_id');
    }
}
