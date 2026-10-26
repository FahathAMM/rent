<?php

namespace App\Models;

use App\Helpers\Media;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A customer identity — intentionally a separate table/guard from `users`
 * (vendor/owner/staff), not a role on it. Authenticates through the
 * `customer` guard (see config/auth.php) and must never be treated as a
 * marketplace vendor account. Has no roles — a customer is just a
 * customer, nothing additive here the way vendor/owner/staff is on User.
 */
class Customer extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, Media, SoftDeletes;

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
}
