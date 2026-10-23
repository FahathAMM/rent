<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A Platform Owner / Platform Admin identity. Intentionally has no
 * company_id and never touches the `users` table — it authenticates
 * through the separate `platform` guard (see config/auth.php) and must
 * never be treated as a company user.
 */
class SystemAdmin extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected string $guard_name = 'platform';

    protected $fillable = [
        'name', 'email', 'password', 'role', 'status', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'password'      => 'hashed',
        'last_login_at' => 'datetime',
    ];

    public function isOwner(): bool
    {
        return $this->role === 'platform_owner';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function impersonationSessions(): HasMany
    {
        return $this->hasMany(ImpersonationSession::class);
    }
}
