<?php

namespace App\Support;

use App\Models\Administration\Menu;
use Illuminate\Support\Collection;
use Spatie\Permission\Models\Permission;

/**
 * Every permission, grouped by the menu page it belongs to — the rows of a
 * Roles & Permissions grid (platform and vendor). Permissions are named
 * "{audience}-{menu-slug}-{action}", e.g. "vendor-vehicles-list-view" (the
 * audience prefix keeps the customer and vendor trees' same-named slugs
 * apart — see MenuSeeder::generatePermissions()).
 */
final class PermissionCatalogue
{
    public const ACTIONS = ['view', 'create', 'edit', 'delete'];

    /**
     * @param string|null    $audience 'vendor' | 'customer' | null for every audience
     * @param callable|null  $allow    keep only permission names this returns true for
     * @return Collection<int, array{audience: ?string, slug: string, name: string, icon: ?string, permissions: array<string, string>}>
     */
    public static function groups(?string $audience = null, ?callable $allow = null): Collection
    {
        $allow ??= fn () => true;
        $permissionsByName = Permission::orderBy('name')->get()->keyBy('name');
        $used = [];

        // Navigable menus only (sections have no route and so no permissions), with their parent's name for context.
        $menus = Menu::with('parent:id,name,sort_order')
            ->whereNotNull('route_name')
            ->when($audience, fn ($q) => $q->where('audience', $audience))
            ->get()
            // Same order as the sidebar: by section, then by page within it.
            ->sortBy(fn (Menu $m) => [$m->audience, $m->parent?->sort_order ?? $m->sort_order, $m->parent ? $m->sort_order : 0])
            ->values();

        $groups = $menus->map(function (Menu $menu) use ($permissionsByName, $allow, &$used) {
            $perms = [];
            foreach (self::ACTIONS as $action) {
                $name = "{$menu->audience}-{$menu->slug}-{$action}";
                if ($permissionsByName->has($name)) {
                    $used[$name] = true;
                    if ($allow($name)) {
                        $perms[$action] = $name;
                    }
                }
            }

            return [
                'audience'    => $menu->audience,
                'slug'        => $menu->slug,
                'name'        => $menu->parent ? "{$menu->parent->name} · {$menu->name}" : $menu->name,
                'icon'        => $menu->icon,
                'permissions' => $perms,
            ];
        })->filter(fn ($g) => $g['permissions'] !== [])->values();

        if ($audience !== null) {
            return $groups;
        }

        // Platform view: anything not tied to a current menu (e.g. a hand-made permission) still shows.
        $orphaned = $permissionsByName->keys()->reject(fn ($name) => isset($used[$name]))
            ->groupBy(fn ($name) => preg_replace('/-(view|create|edit|delete)$/', '', $name))
            ->map(fn ($names, $base) => [
                'audience'    => str_contains($base, '-') ? strstr($base, '-', true) : null,
                'slug'        => $base,
                'name'        => ucfirst(str_replace(['-', '_'], ' ', $base)),
                'icon'        => null,
                'permissions' => $names->mapWithKeys(fn ($n) => [preg_match('/-(view|create|edit|delete)$/', $n, $m) ? $m[1] : $n => $n])->all(),
            ])
            ->values();

        return $groups->concat($orphaned)->values();
    }
}
