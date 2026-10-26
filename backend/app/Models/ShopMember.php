<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Membership pivot: which users may act for which shop, and with what
 * abilities (see app-doc/marketplace/03-permissions-model.md "Layer 3").
 * Deliberately not shop-scoped itself (no BelongsToShop) - resolving it is
 * exactly what establishes the shop context in the first place.
 */
class ShopMember extends Model
{
    public const ROLE_OWNER = 'owner';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_STAFF = 'staff';

    public const STATUS_INVITED = 'invited';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_REVOKED = 'revoked';

    protected $fillable = [
        'shop_id', 'user_id', 'role', 'abilities', 'status',
        'employee_id', 'joining_date', 'emergency_contact',
        'invited_by', 'invite_token', 'invite_expires_at', 'invited_at',
        'accepted_at', 'revoked_at',
    ];

    protected $casts = [
        'abilities' => 'array',
        'joining_date' => 'date',
        'invite_expires_at' => 'datetime',
        'invited_at' => 'datetime',
        'accepted_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function hasAbility(string $ability): bool
    {
        if ($this->role === self::ROLE_OWNER) {
            return true;
        }

        return in_array($ability, $this->abilities ?? [], true);
    }
}
