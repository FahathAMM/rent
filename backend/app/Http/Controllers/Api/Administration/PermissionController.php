<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Models\Administration\Menu;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    // Permissions are named "{menu-slug}-{action}", e.g. "inventory-products-view".
    private const ACTIONS = ['view', 'create', 'edit', 'delete'];

    public function index(): JsonResponse
    {
        $menus = Menu::orderBy('sort_order')->get();
        $allPermissions = Permission::orderBy('name')->get();

        if ($menus->isEmpty()) {
            // No menus seeded yet — fall back to grouping by the permission's slug prefix
            $grouped = $allPermissions
                ->groupBy(fn ($p) => $this->stripAction($p->name))
                ->map(fn ($group, $slug) => [
                    'menu_id'     => null,
                    'name'        => ucfirst(str_replace(['-', '_'], ' ', $slug)),
                    'slug'        => $slug,
                    'icon'        => null,
                    'permissions' => $group->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])->values(),
                ])
                ->sortKeys()
                ->values();

            return response()->json(['data' => $grouped]);
        }

        // ── Menu-grouped permissions ───────────────────────────────────────────

        $permissionsByName = $allPermissions->keyBy('name');

        $grouped = $menus->map(function (Menu $menu) use ($permissionsByName) {
            $perms = collect(self::ACTIONS)
                ->map(fn ($action) => $permissionsByName->get("{$menu->slug}-{$action}"))
                ->filter()
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])
                ->values();

            return [
                'menu_id'     => $menu->id,
                'name'        => $menu->name,
                'slug'        => $menu->slug,
                'icon'        => $menu->icon,
                'permissions' => $perms,
            ];
        })->filter(fn ($g) => count($g['permissions']) > 0)->values();

        // ── Orphaned permissions (not matching any menu slug + action) ────────

        $menuSlugs = $menus->pluck('slug')->flip();
        $orphaned = $allPermissions
            ->filter(fn ($p) => ! $menuSlugs->has($this->stripAction($p->name)))
            ->groupBy(fn ($p) => $this->stripAction($p->name))
            ->map(fn ($group, $slug) => [
                'menu_id'     => null,
                'name'        => ucfirst(str_replace(['-', '_'], ' ', $slug)),
                'slug'        => $slug,
                'icon'        => null,
                'permissions' => $group->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])->values(),
            ])
            ->values();

        return response()->json(['data' => [...$grouped, ...$orphaned]]);
    }

    // Strips a trailing "-{action}" (view/create/edit/delete) from a permission name.
    private function stripAction(string $permissionName): string
    {
        foreach (self::ACTIONS as $action) {
            if (str_ends_with($permissionName, "-{$action}")) {
                return substr($permissionName, 0, -strlen($action) - 1);
            }
        }
        return $permissionName;
    }
}
