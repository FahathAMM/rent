<?php

namespace Database\Seeders;

use App\Models\Administration\Menu;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use App\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the marketplace's two data-driven navigation trees (customer and
 * vendor - see app-doc/marketplace/03-permissions-model.md "The navigation
 * menu becomes three trees") plus the three marketplace roles. The platform
 * admin app's nav is NOT data-driven here - platform admins authorize via
 * SystemAdmin::admin_role, never spatie permissions, so there is no
 * 'platform' audience content to seed yet.
 *
 * This is a lean Phase 1 scaffold, not the full page set from
 * app-doc/marketplace/05-ui-and-api-map.md - it covers only what exists so
 * far, and is expected to grow as later phases add real pages.
 */
class MenuSeeder extends Seeder
{
    /** @var array<int, array> Customer-facing account app. */
    private array $customerModules = [
        [
            'key' => 'dashboard',
            'name' => 'Dashboard',
            'route_name' => '/account/dashboard',
            'icon' => 'LayoutDashboard',
            'sort_order' => 1,
        ],
        [
            'key' => 'bookings',
            'name' => 'My Bookings',
            'route_name' => '/account/bookings',
            'icon' => 'CalendarCheck',
            'sort_order' => 2,
        ],
        [
            'key' => 'favorites',
            'name' => 'Favorites',
            'route_name' => '/account/favorites',
            'icon' => 'Heart',
            'sort_order' => 3,
        ],
        [
            'key' => 'reviews',
            'name' => 'My Reviews',
            'route_name' => '/account/reviews',
            'icon' => 'Star',
            'sort_order' => 4,
        ],
        [
            'key' => 'disputes',
            'name' => 'Disputes',
            'route_name' => '/account/disputes',
            'icon' => 'AlertTriangle',
            'sort_order' => 5,
        ],
        [
            'key' => 'profile',
            'name' => 'Profile',
            'route_name' => '/account/profile',
            'icon' => 'User',
            'sort_order' => 6,
        ],
    ];

    /** @var array<int, array> Vendor app (shop owner and staff). */
    private array $vendorModules = [
        [
            'key' => 'dashboard',
            'name' => 'Dashboard',
            'route_name' => '/vendor/dashboard',
            'icon' => 'LayoutDashboard',
            'sort_order' => 1,
        ],
        [
            'key' => 'vehicles',
            'name' => 'Vehicles',
            'icon' => 'Car',
            'sort_order' => 2,
            'children' => [
                ['key' => 'list', 'name' => 'My Vehicles', 'route_name' => '/vendor/vehicles', 'icon' => 'Car', 'sort_order' => 1],
                ['key' => 'calendar', 'name' => 'Calendar', 'route_name' => '/vendor/calendar', 'icon' => 'CalendarRange', 'sort_order' => 2],
                ['key' => 'categories', 'name' => 'Categories', 'route_name' => '/vendor/vehicles/categories', 'icon' => 'Tag', 'sort_order' => 3],
                ['key' => 'bookings', 'name' => 'Bookings', 'route_name' => '/vendor/bookings', 'icon' => 'CalendarCheck', 'sort_order' => 4],
                ['key' => 'reviews', 'name' => 'Reviews', 'route_name' => '/vendor/reviews', 'icon' => 'Star', 'sort_order' => 5],
                ['key' => 'inquiries', 'name' => 'Inquiries', 'route_name' => '/vendor/inquiries', 'icon' => 'MessageCircle', 'sort_order' => 6],
            ],
        ],
        [
            'key' => 'finance',
            'name' => 'Finance',
            'icon' => 'Wallet',
            'sort_order' => 3,
            'children' => [
                ['key' => 'earnings', 'name' => 'Earnings', 'route_name' => '/vendor/finance/earnings', 'icon' => 'TrendingUp', 'sort_order' => 1],
                ['key' => 'bank_details', 'name' => 'Bank Details', 'route_name' => '/vendor/finance/bank-details', 'icon' => 'Landmark', 'sort_order' => 2],
            ],
        ],
        [
            'key' => 'expense',
            'name' => 'Expenses',
            'icon' => 'Receipt',
            'sort_order' => 4,
            'children' => [
                ['key' => 'expenses', 'name' => 'Expenses', 'route_name' => '/vendor/expenses', 'icon' => 'Receipt', 'sort_order' => 1],
                ['key' => 'categories', 'name' => 'Categories', 'route_name' => '/vendor/expense-categories', 'icon' => 'Tag', 'sort_order' => 2],
            ],
        ],
        [
            // Buying visibility — featured vehicles, category / city sponsorship. Shop owner only (Role::OWNER_ONLY_PREFIXES).
            'key' => 'promotions',
            'name' => 'Promotions',
            'route_name' => '/vendor/promotions',
            'icon' => 'Megaphone',
            'sort_order' => 5,
        ],
        [
            'key' => 'settings',
            'name' => 'Settings',
            'icon' => 'Settings2',
            'sort_order' => 6,
            'children' => [
                ['key' => 'shop', 'name' => 'Shop Profile', 'route_name' => '/vendor/settings/shop', 'icon' => 'Building2', 'sort_order' => 1],
                ['key' => 'locations', 'name' => 'Locations', 'route_name' => '/vendor/settings/locations', 'icon' => 'MapPin', 'sort_order' => 2],
                // Staff and roles sit under Settings in the nav but keep their own slugs, so their
                // permissions stay "vendor-staff-*" / "vendor-roles-*" (StaffController, Role::OWNER_ONLY_PREFIXES).
                ['key' => 'staff', 'slug' => 'staff', 'name' => 'Staff', 'route_name' => '/vendor/staff', 'icon' => 'Users', 'sort_order' => 3],
                // The shop's own roles — shop owner only (its permissions come only with the owner role).
                ['key' => 'roles', 'slug' => 'roles', 'name' => 'Roles & Permissions', 'route_name' => '/vendor/roles', 'icon' => 'KeyRound', 'sort_order' => 4],
                // The shop's plan & paying for it — shop owner only (Role::OWNER_ONLY_PREFIXES).
                ['key' => 'subscription', 'slug' => 'subscription', 'name' => 'Subscription', 'route_name' => '/vendor/settings/subscription', 'icon' => 'Crown', 'sort_order' => 5],
            ],
        ],
    ];

    /**
     * Which "{slug}-{action}" permissions each marketplace role gets. The
     * single source of truth for "what can role X see in the nav" - see
     * app-doc/marketplace/03-permissions-model.md "Layer 1 — Roles".
     * Only platform roles live here (just `customer`). Each shop's roles
     * belong to that shop: shop-owner (created on registration, full access)
     * and any the owner creates.
     */
    /**
     * Which navigation audience each role's permissions below are
     * qualified against - see generatePermissions()/the permission-name
     * note on the menus table migration. Every role here touches exactly
     * one audience's slugs, so a single map suffices.
     */
    private array $roleAudience = [
        'customer'   => 'customer',
    ];

    private array $rolePermissions = [
        'customer' => [
            'dashboard'          => ['view'],
            'bookings'           => ['view', 'create', 'edit'],
            'favorites'          => ['view', 'create', 'delete'],
            'reviews'            => ['view', 'create'],
            'disputes'           => ['view', 'create'],
            'profile'            => ['view', 'edit'],
        ],
    ];

    public function run(): void
    {
        // Menus are rebuilt from the definitions above every run. Permissions
        // and role assignments are NOT wiped: they're only created when
        // missing, so role changes made on the platform's Roles & Permissions
        // page survive a re-seed (see the role loop below).
        Schema::disableForeignKeyConstraints();
        DB::table('model_has_permissions')->truncate();
        Menu::truncate();
        Schema::enableForeignKeyConstraints();
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (array_keys($this->rolePermissions) as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web', 'shop_id' => null]);
        }

        DB::transaction(function () {
            foreach ($this->customerModules as $module) {
                $this->seedModule($module, 'customer', null, null);
            }
            foreach ($this->vendorModules as $module) {
                $this->seedModule($module, 'vendor', null, null);
            }
        });

        $this->generatePermissions();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->rolePermissions as $roleName => $slugActions) {
            $role = Role::findByName($roleName, 'web');
            $audience = $this->roleAudience[$roleName];

            // Defaults only on a fresh install — after that the platform's
            // Roles & Permissions page owns them.
            if ($role->permissions()->exists()) {
                continue;
            }

            $permissionNames = [];
            foreach ($slugActions as $slug => $actions) {
                foreach ($actions as $action) {
                    $permissionNames[] = "{$audience}-{$slug}-{$action}";
                }
            }
            $role->syncPermissions(Permission::whereIn('name', $permissionNames)->get());
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    /**
     * Recursively upserts a module (and its children, if any), building the
     * stored slug as parent-child-child... by chaining each ancestor's key.
     * A module may set its own 'slug' to keep its permission names when it
     * is moved under a different parent.
     */
    private function seedModule(array $module, string $audience, ?string $parentSlug, ?int $parentId): void
    {
        $slug = $module['slug'] ?? ($parentSlug ? "{$parentSlug}-{$module['key']}" : $module['key']);

        if (isset($module['children'])) {
            $parent = $this->section($audience, $slug, $module['name'], $module['sort_order'], $module['icon'] ?? null, $parentId);
            Log::info("Seeding menu item: {$slug} ({$module['name']}) [{$audience}]");

            foreach ($module['children'] as $child) {
                $this->seedModule($child, $audience, $slug, $parent->id);
            }
        } else {
            Log::info("Seeding menu item: {$slug} ({$module['name']}) [{$audience}]");
            $this->upsert($audience, $slug, [
                'name'       => $module['name'],
                'route_name' => $module['route_name'],
                'icon'       => $module['icon'] ?? null,
                'sort_order' => $module['sort_order'],
                'parent_id'  => $parentId,
            ]);
        }
    }

    private function upsert(string $audience, string $slug, array $attrs): Menu
    {
        $menu = Menu::firstOrNew(['audience' => $audience, 'slug' => $slug]);
        $menu->audience   = $audience;
        $menu->slug       = $slug;
        $menu->name       = $attrs['name'];
        $menu->route_name = $attrs['route_name'];
        $menu->icon       = $attrs['icon'];
        $menu->sort_order = $attrs['sort_order'];
        $menu->parent_id  = $attrs['parent_id'];
        $menu->is_active  = true;
        $menu->save();
        return $menu;
    }

    /**
     * For every navigable menu (has a route), create its 4 CRUD
     * permissions named "{audience}-{slug}-{action}". Qualified by
     * audience on purpose: the customer and vendor trees both legitimately
     * have a "dashboard"/"bookings" slug (see the menus table migration),
     * and without the audience prefix those would collapse into the same
     * permission - letting a plain customer's "dashboard-view" permission
     * also satisfy the vendor dashboard's check, and show up in a nav tree
     * it should never appear in.
     */
    private function generatePermissions(): void
    {
        $menus = Menu::whereNotNull('route_name')->get(['audience', 'slug']);
        $names = [];

        foreach ($menus as $menu) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                $names[] = $name = "{$menu->audience}-{$menu->slug}-{$action}";
                Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            }
        }

        // Drop permissions for menus that no longer exist (their role links go with them).
        Permission::whereNotIn('name', $names)->get()->each->delete();
    }

    private function section(string $audience, string $slug, string $name, int $sortOrder, ?string $icon = null, ?int $parentId = null): Menu
    {
        $menu = Menu::firstOrNew(['audience' => $audience, 'slug' => $slug]);
        $menu->fill([
            'audience'   => $audience,
            'slug'       => $slug,
            'name'       => $name,
            'route_name' => null,
            'icon'       => $icon,
            'parent_id'  => $parentId,
            'sort_order' => $sortOrder,
            'is_active'  => true,
        ]);
        $menu->save();
        return $menu;
    }
}
