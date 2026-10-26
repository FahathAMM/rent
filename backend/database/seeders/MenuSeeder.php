<?php

namespace Database\Seeders;

use App\Models\Administration\Menu;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the marketplace's two data-driven navigation trees (customer and
 * vendor - see app-doc/marketplace/03-permissions-model.md "The navigation
 * menu becomes three trees") plus the four marketplace roles. The platform
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

    /** @var array<int, array> Owner / shop-staff facing vendor app. */
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
                ['key' => 'calendar', 'name' => 'Calendar', 'route_name' => '/vendor/vehicles/calendar', 'icon' => 'CalendarRange', 'sort_order' => 2],
            ],
        ],
        [
            'key' => 'bookings',
            'name' => 'Bookings',
            'route_name' => '/vendor/bookings',
            'icon' => 'CalendarCheck',
            'sort_order' => 3,
        ],
        [
            'key' => 'reviews',
            'name' => 'Reviews',
            'route_name' => '/vendor/reviews',
            'icon' => 'Star',
            'sort_order' => 4,
        ],
        [
            'key' => 'inquiries',
            'name' => 'Inquiries',
            'route_name' => '/vendor/inquiries',
            'icon' => 'MessageCircle',
            'sort_order' => 5,
        ],
        [
            'key' => 'finance',
            'name' => 'Finance',
            'icon' => 'Wallet',
            'sort_order' => 6,
            'children' => [
                ['key' => 'earnings', 'name' => 'Earnings', 'route_name' => '/vendor/finance/earnings', 'icon' => 'TrendingUp', 'sort_order' => 1],
                ['key' => 'payouts', 'name' => 'Payouts', 'route_name' => '/vendor/finance/payouts', 'icon' => 'Banknote', 'sort_order' => 2],
                ['key' => 'bank_details', 'name' => 'Bank Details', 'route_name' => '/vendor/finance/bank-details', 'icon' => 'Landmark', 'sort_order' => 3],
            ],
        ],
        [
            'key' => 'expense',
            'name' => 'Expenses',
            'icon' => 'Receipt',
            'sort_order' => 7,
            'children' => [
                ['key' => 'expenses', 'name' => 'Expenses', 'route_name' => '/vendor/expenses', 'icon' => 'Receipt', 'sort_order' => 1],
                ['key' => 'categories', 'name' => 'Categories', 'route_name' => '/vendor/expense-categories', 'icon' => 'Tag', 'sort_order' => 2],
            ],
        ],
        [
            'key' => 'staff',
            'name' => 'Staff',
            'route_name' => '/vendor/staff',
            'icon' => 'Users',
            'sort_order' => 8,
        ],
        [
            'key' => 'settings',
            'name' => 'Settings',
            'icon' => 'Settings2',
            'sort_order' => 9,
            'children' => [
                ['key' => 'shop', 'name' => 'Shop Profile', 'route_name' => '/vendor/settings/shop', 'icon' => 'Building2', 'sort_order' => 1],
                ['key' => 'locations', 'name' => 'Locations', 'route_name' => '/vendor/settings/locations', 'icon' => 'MapPin', 'sort_order' => 2],
            ],
        ],
    ];

    /**
     * Which "{slug}-{action}" permissions each marketplace role gets. The
     * single source of truth for "what can role X see in the nav" - see
     * app-doc/marketplace/03-permissions-model.md "Layer 1 — Roles".
     * Fine-grained per-shop abilities (can THIS staff member respond to
     * bookings at THIS shop) are a separate layer on shop_members.abilities,
     * not here.
     */
    /**
     * Which navigation audience each role's permissions below are
     * qualified against - see generatePermissions()/the permission-name
     * note on the menus table migration. Every role here touches exactly
     * one audience's slugs, so a single map suffices.
     */
    private array $roleAudience = [
        'customer'      => 'customer',
        'vehicle-owner' => 'vendor',
        'shop-owner'    => 'vendor',
        'shop-staff'    => 'vendor',
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
        'vehicle-owner' => [
            'dashboard'          => ['view'],
            'vehicles-list'      => ['view', 'create', 'edit', 'delete'],
            'vehicles-calendar'  => ['view', 'edit'],
            'bookings'           => ['view', 'create', 'edit'],
            'reviews'            => ['view', 'edit'],
            'inquiries'          => ['view', 'edit'],
            'finance-earnings'   => ['view'],
            'finance-payouts'    => ['view'],
            'finance-bank_details' => ['view', 'edit'],
            'expense-expenses'   => ['view', 'create', 'edit', 'delete'],
            'expense-categories' => ['view', 'create', 'edit', 'delete'],
            'staff'              => ['view', 'create', 'edit', 'delete'],
            'settings-shop'      => ['view', 'edit'],
            'settings-locations' => ['view', 'create', 'edit', 'delete'],
        ],
        'shop-owner' => [
            'dashboard'          => ['view'],
            'vehicles-list'      => ['view', 'create', 'edit', 'delete'],
            'vehicles-calendar'  => ['view', 'edit'],
            'bookings'           => ['view', 'create', 'edit'],
            'reviews'            => ['view', 'edit'],
            'inquiries'          => ['view', 'edit'],
            'finance-earnings'   => ['view'],
            'finance-payouts'    => ['view'],
            'finance-bank_details' => ['view', 'edit'],
            'expense-expenses'   => ['view', 'create', 'edit', 'delete'],
            'expense-categories' => ['view', 'create', 'edit', 'delete'],
            'staff'              => ['view', 'create', 'edit', 'delete'],
            'settings-shop'      => ['view', 'edit'],
            'settings-locations' => ['view', 'create', 'edit', 'delete'],
        ],
        'shop-staff' => [
            'dashboard'          => ['view'],
            'vehicles-list'      => ['view', 'edit'],
            'vehicles-calendar'  => ['view', 'edit'],
            'bookings'           => ['view', 'edit'],
            'reviews'            => ['view', 'edit'],
            'inquiries'          => ['view', 'edit'],
            'expense-expenses'   => ['view'],
        ],
    ];

    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('model_has_permissions')->truncate();
        DB::table('role_has_permissions')->truncate();
        Permission::truncate();
        Menu::truncate();
        Schema::enableForeignKeyConstraints();
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (array_keys($this->rolePermissions) as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
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
     */
    private function seedModule(array $module, string $audience, ?string $parentSlug, ?int $parentId): void
    {
        $slug = $parentSlug ? "{$parentSlug}-{$module['key']}" : $module['key'];

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

        foreach ($menus as $menu) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                Permission::firstOrCreate([
                    'name'       => "{$menu->audience}-{$menu->slug}-{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }
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
