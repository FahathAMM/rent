<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * One piece of Stay safe, FAQ, Terms & Conditions or Privacy Policy content, managed under
 * Help & Support in the platform admin. What the columns hold depends on the type:
 *   faq               - section = group, title = question, body = answer
 *   safety_tip        - section = group, title = the tip
 *   warning_sign      - title = the sign
 *   emergency_contact - title = service, body = number
 *   terms, privacy    - title = clause heading, body = clause text as cleaned HTML
 */
class HelpItem extends Model
{
    public const TYPES = ['faq', 'safety_tip', 'warning_sign', 'emergency_contact', 'terms', 'privacy'];

    /** Types whose body comes from the rich text editor. */
    public const RICH_TYPES = ['terms', 'privacy'];

    protected $fillable = ['type', 'section', 'title', 'body', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }
}
