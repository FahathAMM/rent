<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Platform-wide branding shown in every tenant's app sidebar. Only ever one
 * row — use current() rather than querying the table directly.
 */
class PlatformDetail extends Model
{
    protected $fillable = [
        'name', 'logo', 'login_logo', 'tagline',
        'login_eyebrow', 'login_heading', 'login_description',
    ];

    public static function current(): ?self
    {
        return static::query()->first();
    }
}
