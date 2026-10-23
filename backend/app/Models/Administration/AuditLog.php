<?php

namespace App\Models\Administration;

use App\Models\Concerns\BelongsToCompany;
use App\Models\SystemAdmin;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'user_id', 'system_admin_id', 'action', 'form', 'record_id', 'record',
        'old_values', 'new_values', 'ip', 'browser',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The platform admin who performed this action, when it wasn't a company user (e.g. impersonation start/stop). */
    public function systemAdmin(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class);
    }
}
