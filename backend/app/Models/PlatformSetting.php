<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Key-value platform configuration. Seeded defaults live in
 * PlatformSettingSeeder (later phase) - including
 * allow_unapproved_owner_publishing = false, which must stay false unless
 * a platform admin explicitly enables it (see
 * app-doc/marketplace/01-phase1-architecture.md section 3.1).
 */
class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value', 'group', 'label', 'description', 'type', 'is_public', 'updated_by'];

    protected $casts = [
        'value' => 'array',
        'is_public' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(SystemAdmin::class, 'updated_by');
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('key', $key)->first();

        return $row ? ($row->value['value'] ?? $row->value) : $default;
    }
}
