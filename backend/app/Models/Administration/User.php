<?php

namespace App\Models\Administration;

use App\Helpers\Media;
use App\Models\RentalShop;
use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * A marketplace account - customer, owner or shop staff. A user belongs to
 * at most one shop (shop_id); what they may do there comes only from their
 * role, which is one of that shop's own roles (roles.shop_id): the owner
 * holds its shop-owner role (full access, given on registration); staff hold
 * a role the owner created.
 * Someone running two shops uses two accounts. There is deliberately no special-cased
 * "super-admin bypasses everything" role here (the old chicken-shop app
 * had that, confusingly duplicating what the separate SystemAdmin/
 * `platform` guard already does - see app-doc/marketplace/03-permissions-
 * model.md "Layer 0"). Platform admin powers live exclusively in
 * SystemAdmin; a marketplace user's roles (customer, plus their shop role)
 * are additive and never grant platform access.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, Media, SoftDeletes;

    protected string $guard_name = 'web';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_BANNED = 'banned';

    public const SHOP_ROLE_OWNER = 'owner';
    /** Anyone else in the shop: holds a role the owner created. */
    public const SHOP_ROLE_MEMBER = 'member';

    protected $fillable = [
        'name', 'email', 'password', 'phone', 'avatar', 'status',
        'last_login_at', 'registration_source', 'terms_accepted_at',
        'shop_id', 'employee_id', 'joining_date', 'emergency_contact',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'last_login_at' => 'datetime',
        'terms_accepted_at' => 'datetime',
        'joining_date' => 'date',
    ];

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    /**
     * The shop's registered owner (rental_shops.owner_user_id) — true even
     * if the shop-owner role (granted on registration) is ever missing.
     */
    public function isShopOwner(): bool
    {
        return $this->shop_id !== null && (int) $this->shop?->owner_user_id === $this->id;
    }

    /** The shop role this user holds (shop-owner, or one the owner made), if any. */
    public function memberRole(): ?Role
    {
        if ($this->shop_id === null) {
            return null;
        }
        $this->loadMissing('roles');

        return $this->roles->first(fn ($r) => (int) $r->shop_id === (int) $this->shop_id);
    }

    /** 'owner' | 'member' | null — the owner has full access, everyone else what their shop role allows. */
    public function shopRole(): ?string
    {
        if ($this->shop_id === null) {
            return null;
        }
        if ($this->isShopOwner()) {
            return self::SHOP_ROLE_OWNER;
        }

        return $this->memberRole() ? self::SHOP_ROLE_MEMBER : null;
    }

    /** Display name of the member's role: "Owner", or their shop role's ("Manager", "Driver", ...). */
    public function shopRoleLabel(): ?string
    {
        return match ($this->shopRole()) {
            self::SHOP_ROLE_OWNER => 'Owner',
            self::SHOP_ROLE_MEMBER => $this->memberRole()?->name,
            default => null,
        };
    }

    /**
     * May this member do this vendor action? shop-owner can do everything;
     * anyone else, what their role allows. Shop membership itself is checked
     * by ShopGate / ShopScope.
     */
    public function hasVendorPermission(string $permission): bool
    {
        // checkPermissionTo returns false (rather than throwing) for an unknown permission name
        return $this->hasRole(Role::SHOP_OWNER) || $this->checkPermissionTo($permission);
    }

    /**
     * Give the user exactly one shop role, or none with null:
     *   - 'owner' → their shop's shop-owner role (full access);
     *   - a Role  → one of their shop's roles.
     * Swaps only shop roles — `customer` stays.
     */
    public function setShopRole(Role|string|null $role): void
    {
        $wanted = $role === self::SHOP_ROLE_OWNER ? Role::shopOwnerOf($this->shop_id) : $role;
        $this->loadMissing('roles');

        foreach ($this->roles as $current) {
            if ($current->shop_id !== null && $current->id !== $wanted?->id) {
                $this->removeRole($current);
            }
        }
        if ($wanted && !$this->roles()->whereKey($wanted->id)->exists()) {
            $this->assignRole($wanted);
        }
        $this->unsetRelation('roles');
    }

    public function ownedShops(): HasMany
    {
        return $this->hasMany(RentalShop::class, 'owner_user_id');
    }
}
