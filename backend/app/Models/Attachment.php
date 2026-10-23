<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Generic polymorphic uploads. Deliberately NOT shop-scoped via
 * BelongsToShop/ShopScope: shop_id is nullable (an owner's KYC documents
 * are attached before their personal shop exists), and forcing the global
 * scope here would silently hide those null-shop_id rows the moment any
 * shop context became active. Authorization instead happens per
 * attachable_type in the controller/service layer (later phase) - see
 * app-doc/marketplace/01-phase1-architecture.md section 1.1.
 */
class Attachment extends Model
{
    use HasFactory;

    public const VISIBILITY_PUBLIC = 'public';
    public const VISIBILITY_PRIVATE = 'private';
    public const VISIBILITY_RESTRICTED = 'restricted';

    protected $fillable = [
        'shop_id', 'uploaded_by', 'file_name', 'file_path', 'disk', 'mime_type',
        'file_size', 'checksum', 'attachable_type', 'attachable_id', 'document_type', 'visibility',
    ];

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    public function isPublic(): bool
    {
        return $this->visibility === self::VISIBILITY_PUBLIC;
    }
}
