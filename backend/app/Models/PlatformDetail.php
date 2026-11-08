<?php

namespace App\Models;

use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Model;

/**
 * Platform-wide branding shown in every tenant's app sidebar. Only ever one
 * row — use current() rather than querying the table directly.
 */
class PlatformDetail extends Model
{
    use HasTranslations;

    /** Columns with other-language text in `translations` (see HasTranslations). */
    protected array $translatable = ['tagline', 'login_eyebrow', 'login_heading', 'login_description'];

    protected $fillable = [
        'name', 'logo', 'login_logo', 'tagline',
        'login_eyebrow', 'login_heading', 'login_description',
        'support_email', 'support_phone', 'support_whatsapp', 'support_address', 'support_hours',
    ];

    public static function current(): ?self
    {
        return static::query()->first();
    }
}
