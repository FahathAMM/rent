<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A platform admin identity. Intentionally has no shop_id and never
 * touches `users` - it authenticates through the separate `platform`
 * guard (see config/auth.php) and must never be treated as a marketplace
 * account. admin_role splits platform duties (see
 * app-doc/marketplace/03-permissions-model.md "Platform admin roles") so
 * only finance approves payouts/refunds, only moderator acts on listings/
 * reviews, etc.
 */
class SystemAdmin extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected string $guard_name = 'platform';

    public const ROLE_PLATFORM_OWNER = 'platform_owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_FINANCE = 'finance';
    public const ROLE_MODERATOR = 'moderator';
    public const ROLE_SUPPORT = 'support';

    protected $fillable = [
        'name', 'email', 'password', 'admin_role', 'status', 'is_active', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'password' => 'hashed',
        'is_active' => 'boolean',
        'last_login_at' => 'datetime',
    ];

    public function isOwner(): bool
    {
        return $this->admin_role === self::ROLE_PLATFORM_OWNER;
    }

    public function isFinance(): bool
    {
        return in_array($this->admin_role, [self::ROLE_PLATFORM_OWNER, self::ROLE_FINANCE], true);
    }

    public function isModerator(): bool
    {
        return in_array($this->admin_role, [self::ROLE_PLATFORM_OWNER, self::ROLE_MODERATOR], true);
    }

    public function isSupport(): bool
    {
        return in_array($this->admin_role, [self::ROLE_PLATFORM_OWNER, self::ROLE_SUPPORT], true);
    }

    public function isActive(): bool
    {
        return $this->is_active;
    }

    public function impersonationSessions(): HasMany
    {
        return $this->hasMany(ImpersonationSession::class);
    }
}
