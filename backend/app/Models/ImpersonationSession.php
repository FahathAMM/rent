<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImpersonationSession extends Model
{
    protected $fillable = [
        'system_admin_id', 'company_id', 'user_id', 'personal_access_token_id',
        'started_at', 'ended_at', 'ip_address', 'user_agent',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at'   => 'datetime',
    ];

    public function systemAdmin(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->ended_at === null;
    }
}
