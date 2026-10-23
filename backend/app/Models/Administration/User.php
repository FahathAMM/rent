<?php

namespace App\Models\Administration;

use App\Helpers\Media;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, Media, SoftDeletes, BelongsToCompany {
        HasRoles::hasRole as protected traitHasRole;
    }

    protected string $guard_name = 'web';

    protected $fillable = [
        'company_id', 'name', 'email', 'password', 'phone', 'is_active',
        'avatar', 'employee_id', 'gender', 'date_of_birth', 'joining_date',
        'address', 'emergency_contact',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
        'is_active'         => 'boolean',
        'date_of_birth'     => 'date',
        'joining_date'      => 'date',
    ];


    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isOwner(): bool
    {
        return $this->hasRole('owner');
    }

    public function isSuperAdmin(): bool
    {
        return $this->roles->contains('name', 'super-admin');
    }

    /**
     * super-admin passes every hasRole()/hasAnyRole() check, so the
     * `role:...` middleware (which never goes through Gate) also treats
     * them as having whatever role a route requires.
     */
    public function hasRole($roles, ?string $guard = null): bool
    {
        $this->loadMissing('roles');

        if ($this->roles->contains('name', 'super-admin')) {
            return true;
        }

        return $this->traitHasRole($roles, $guard);
    }

    /**
     * Replaces Policy classes app-wide: pass a permission name. super-admin
     * bypasses the check entirely.
     */
    public function can($permission, $arguments = []): bool
    {
        if ($this->hasRole('super-admin')) {
            return true;
        }

        // Spatie's safe variant: returns false instead of throwing if the
        // permission name doesn't exist in the database.
        return $this->checkPermissionTo($permission);
    }
}
