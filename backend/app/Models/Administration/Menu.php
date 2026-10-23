<?php

namespace App\Models\Administration;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class Menu extends Model
{
    protected $fillable = [
        'name', 'slug', 'route_name', 'icon',
        'parent_id', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    protected static function boot(): void
    {
        parent::boot();

        // Auto-generate 4 CRUD permissions when a real (navigable) menu is created.
        // Section headers (route_name is null) are purely organisational and need no permissions.
        static::created(function (Menu $menu) {
            if (empty($menu->route_name)) return;

            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                Permission::firstOrCreate([
                    'name'       => "{$menu->slug}-{$action}",
                    'guard_name' => 'web',
                ]);
            }
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        // Remove the menu's permissions when it is deleted (navigable menus only).
        static::deleting(function (Menu $menu) {
            if (empty($menu->route_name)) return;

            Permission::where('name', 'like', "{$menu->slug}-%")->delete();
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Menu::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Menu::class, 'parent_id')->orderBy('sort_order');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeRoots($query)
    {
        return $query->whereNull('parent_id');
    }
}
