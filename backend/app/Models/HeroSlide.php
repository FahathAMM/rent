<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/** A home page hero slide (image + headline), managed from /platform/hero-slides. Platform-wide, not shop-owned. */
class HeroSlide extends Model
{
    protected $fillable = ['title', 'subtitle', 'image', 'link_url', 'link_label', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = ['image_url'];

    /**
     * Uploads are public-disk paths ("hero-slides/x.jpg") served as
     * same-origin /storage/* (Next.js rewrites it to the backend - see
     * PlatformDetailResource). The default slides from HeroSlideSeeder are
     * instead absolute paths to the frontend's own stock photos
     * ("/images/hero/x.webp") and are used as-is.
     */
    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) {
            return null;
        }

        return $this->isBundledImage() ? $this->image : '/storage/' . $this->image;
    }

    /** True for the frontend's bundled stock photos - never a file on the public disk to delete. */
    public function isBundledImage(): bool
    {
        return str_starts_with((string) $this->image, '/');
    }

    /** Delete the uploaded image file, if this slide has one on the public disk. */
    public function deleteImageFile(): void
    {
        if ($this->image && !$this->isBundledImage()) {
            Storage::disk('public')->delete($this->image);
        }
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }
}
