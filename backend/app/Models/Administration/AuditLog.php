<?php

namespace App\Models\Administration;

use App\Models\RentalShop;
use App\Models\SystemAdmin;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only audit trail. Either user_id (a marketplace account) or
 * system_admin_id (a platform admin) identifies the actor - never both.
 * Deliberately not shop-scoped (no BelongsToShop): a platform admin
 * action (verification decision, payout, commission change) often has no
 * single shop context, and the audit trail must never be hidden by
 * ShopScope regardless.
 */
class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'system_admin_id', 'shop_id', 'action', 'form', 'record_id', 'record',
        'before', 'after', 'severity', 'context', 'ip', 'browser', 'user_agent',
    ];

    protected $casts = [
        'before' => 'array',
        'after' => 'array',
        'context' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The platform admin who performed this action, when it wasn't a marketplace user. */
    public function systemAdmin(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class);
    }

    /** Display-only - never used for scoping (AuditLog is deliberately not shop-scoped). */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(RentalShop::class, 'shop_id');
    }
}
