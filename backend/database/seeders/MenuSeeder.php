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

class MenuSeeder extends Seeder
{
    /**
     * Every module the sidebar can show, as data instead of imperative calls.
     * 'key' is just this node's own local segment — the stored slug is built
     * by walking the tree and joining each ancestor's key with '-', e.g.
     * tailoring -> orders becomes the slug "tailoring-orders".
     * A module with no 'children' is a root stand-alone item (e.g. Dashboard).
     * A module with 'children' is rendered as a section header whose children
     * become the actual menu items underneath it.
     */
    private array $modules = [
        [
            'key' => 'dashboard',
            'name' => 'Dashboard',
            'route_name' => '/dashboard',
            'icon' => 'LayoutDashboard',
            'sort_order' => 1,
        ],

        // Its own top-level module (not a Sales child) — POS is the
        // cashier-facing checkout screen, distinct enough from the Sales
        // list/report that it deserves its own header tab.
        [
            'key' => 'pos',
            'name' => 'POS',
            'icon' => 'ShoppingCart',
            'sort_order' => 2,
            'children' => [
                [
                    'key' => 'new_sale',
                    'name' => 'New Sale',
                    'route_name' => '/pos',
                    'icon' => 'ShoppingCart',
                    'sort_order' => 1,
                ],
            ],
        ],

        [
            'key' => 'sales',
            'name' => 'Sales',
            'icon' => 'Store',
            'sort_order' => 3,
            'children' => [
                [
                    'key' => 'orders',
                    'name' => 'Sales',
                    'route_name' => '/sales',
                    'icon' => 'Receipt',
                    'sort_order' => 1,
                ],
                [
                    'key' => 'customers',
                    'name' => 'Customers',
                    'route_name' => '/customers',
                    'icon' => 'Users',
                    'sort_order' => 2,
                ],
            ],
        ],

        [
            'key' => 'product',
            'name' => 'Product',
            'icon' => 'Package',
            'sort_order' => 4,
            'children' => [
                [
                    'key' => 'item',
                    'name' => 'Items',
                    'route_name' => '/products',
                    'icon' => 'Package',
                    'sort_order' => 1,
                ],
                [
                    'key' => 'unit',
                    'name' => 'Units',
                    'route_name' => '/units',
                    'icon' => 'Ruler',
                    'sort_order' => 2,
                ],
            ],
        ],

        [
            'key' => 'purchasing',
            'name' => 'Purchasing',
            'icon' => 'ShoppingCart',
            'sort_order' => 5,
            'children' => [
                [
                    'key' => 'vendors',
                    'name' => 'Vendors',
                    'route_name' => '/vendors',
                    'icon' => 'Truck',
                    'sort_order' => 1,
                ],
                [
                    'key' => 'purchases',
                    'name' => 'Purchases',
                    'route_name' => '/purchases',
                    'icon' => 'ShoppingBag',
                    'sort_order' => 2,
                ],
            ],
        ],

        [
            'key' => 'expense',
            'name' => 'Expense',
            'icon' => 'Receipt',
            'sort_order' => 6,
            'children' => [
                [
                    'key' => 'expenses',
                    'name' => 'Expenses',
                    'route_name' => '/expenses',
                    'icon' => 'Receipt',
                    'sort_order' => 1,
                ],
                [
                    'key' => 'categories',
                    'name' => 'Categories',
                    'route_name' => '/expense-categories',
                    'icon' => 'Tag',
                    'sort_order' => 2,
                ],
            ],
        ],

        // Reports — a section header (see ReportService::TYPES on the
        // backend); each child is its own page/permission.
        [
            'key' => 'reports',
            'name' => 'Reports',
            'icon' => 'FileBarChart',
            'sort_order' => 7,
            'children' => [
                [
                    'key' => 'sales',
                    'name' => 'Sales Report',
                    'route_name' => '/reports/sales',
                    'icon' => 'Receipt',
                    'sort_order' => 1,
                ],
                [
                    'key' => 'outstanding_sales',
                    'name' => 'Outstanding Receivables',
                    'route_name' => '/reports/outstanding_sales',
                    'icon' => 'AlertTriangle',
                    'sort_order' => 2,
                ],
                [
                    'key' => 'purchases',
                    'name' => 'Purchase Report',
                    'route_name' => '/reports/purchases',
                    'icon' => 'ShoppingBag',
                    'sort_order' => 3,
                ],
                [
                    'key' => 'expenses',
                    'name' => 'Expense Report',
                    'route_name' => '/reports/expenses',
                    'icon' => 'Receipt',
                    'sort_order' => 4,
                ],
                [
                    'key' => 'outstanding_purchases',
                    'name' => 'Outstanding Payables',
                    'route_name' => '/reports/outstanding_purchases',
                    'icon' => 'AlertTriangle',
                    'sort_order' => 5,
                ],
                [
                    'key' => 'item_sales',
                    'name' => 'Item-wise Sales',
                    'route_name' => '/reports/item_sales',
                    'icon' => 'PackageSearch',
                    'sort_order' => 6,
                ],
                [
                    'key' => 'profit_margin',
                    'name' => 'Profit / Margin',
                    'route_name' => '/reports/profit_margin',
                    'icon' => 'TrendingUp',
                    'sort_order' => 7,
                ],
                [
                    'key' => 'daily_sales',
                    'name' => 'Sales Summary',
                    'route_name' => '/reports/daily_sales',
                    'icon' => 'CalendarRange',
                    'sort_order' => 8,
                ],
                [
                    'key' => 'customer_ledger',
                    'name' => 'Customer Ledger',
                    'route_name' => '/reports/customer_ledger',
                    'icon' => 'Contact',
                    'sort_order' => 9,
                ],
                [
                    'key' => 'expense_by_category',
                    'name' => 'Expense by Category',
                    'route_name' => '/reports/expense_by_category',
                    'icon' => 'PieChart',
                    'sort_order' => 10,
                ],
            ],
        ],

        [
            'key' => 'admin',
            'name' => 'Settings',
            'icon' => 'Settings2',
            'sort_order' => 8,
            'children' => [
                [
                    'key' => 'company',
                    'name' => 'Company',
                    'route_name' => '/settings/company',
                    'icon' => 'Building2',
                    'sort_order' => 1
                ],
                [
                    'key' => 'users',
                    'name' => 'Users',
                    'route_name' => '/users',
                    'icon' => 'Users',
                    'sort_order' => 2
                ],
                [
                    'key' => 'roles',
                    'name' => 'Roles & Permissions',
                    'route_name' => '/roles',
                    'icon' => 'ShieldCheck',
                    'sort_order' => 3
                ],
                [
                    'key' => 'menus',
                    'name' => 'Menus',
                    'route_name' => '/menus',
                    'icon' => 'LayoutList',
                    'sort_order' => 4
                ],
                [
                    'key' => 'audit_logs',
                    'name' => 'Audit Logs',
                    'route_name' => '/audit-logs',
                    'icon' => 'Activity',
                    'sort_order' => 5
                ],
            ],
        ],
    ];

    /**
     * Which "{slug}-{action}" permissions each tenant/system role gets,
     * curated explicitly (unlike super-admin, which gets every permission —
     * see run()). Extended per phase as new modules land: this file is the
     * single source of truth for "who can see/do what" in the sidebar.
     *
     * Only owner/admin exist for now — add back any additional tenant roles
     * (cashier, staff, ...) once the chicken-shop modules they need are built.
     */
    private array $rolePermissions = [
        'owner' => [
            'dashboard'                     => ['view'],
            'pos-new_sale'                  => ['view', 'create'],
            'sales-orders'                  => ['view', 'create', 'edit', 'delete'],
            'sales-customers'               => ['view', 'create', 'edit', 'delete'],
            'product-item'                  => ['view', 'create', 'edit', 'delete'],
            'product-unit'                  => ['view', 'create', 'edit', 'delete'],
            'purchasing-vendors'            => ['view', 'create', 'edit', 'delete'],
            'purchasing-purchases'          => ['view', 'create', 'edit', 'delete'],
            'expense-expenses'              => ['view', 'create', 'edit', 'delete'],
            'expense-categories'            => ['view', 'create', 'edit', 'delete'],
            'reports-sales'                 => ['view'],
            'reports-outstanding_sales'     => ['view'],
            'reports-purchases'             => ['view'],
            'reports-expenses'              => ['view'],
            'reports-outstanding_purchases' => ['view'],
            'reports-item_sales'            => ['view'],
            'reports-profit_margin'         => ['view'],
            'reports-daily_sales'           => ['view'],
            'reports-customer_ledger'       => ['view'],
            'reports-expense_by_category'   => ['view'],
            'admin-company'                 => ['view', 'edit'],
            'admin-users'                   => ['view', 'create', 'edit', 'delete'],
            'admin-audit_logs'              => ['view'],
        ],
        'admin' => [
            'dashboard'                     => ['view'],
            'pos-new_sale'                  => ['view', 'create'],
            'sales-orders'                  => ['view', 'create', 'edit', 'delete'],
            'sales-customers'               => ['view', 'create', 'edit', 'delete'],
            'product-item'                  => ['view', 'create', 'edit', 'delete'],
            'product-unit'                  => ['view', 'create', 'edit', 'delete'],
            'purchasing-vendors'            => ['view', 'create', 'edit', 'delete'],
            'purchasing-purchases'          => ['view', 'create', 'edit', 'delete'],
            'expense-expenses'              => ['view', 'create', 'edit', 'delete'],
            'expense-categories'            => ['view', 'create', 'edit', 'delete'],
            'reports-sales'                 => ['view'],
            'reports-outstanding_sales'     => ['view'],
            'reports-purchases'             => ['view'],
            'reports-expenses'              => ['view'],
            'reports-outstanding_purchases' => ['view'],
            'reports-item_sales'            => ['view'],
            'reports-profit_margin'         => ['view'],
            'reports-daily_sales'           => ['view'],
            'reports-customer_ledger'       => ['view'],
            'reports-expense_by_category'   => ['view'],
            'admin-company'                 => ['view', 'edit'],
            'admin-users'                   => ['view', 'create', 'edit', 'delete'],
            'admin-audit_logs'              => ['view'],
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

        // super-admin: cannot be deleted (RoleController::destroy) and
        // bypasses every permission/role check (AppServiceProvider::boot,
        // User::hasRole) — it's synced every permission below purely so the
        // Roles management screen shows it as "full access", not because
        // the bypass needs it.
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);

        // Tenant/company roles — every company's users pick from this same
        // shared set (see app/Support/Tenant.php and BelongsToCompany for
        // why sharing role *definitions* across tenants is safe: data access
        // is enforced per-row by CompanyScope, not by the role system).
        foreach (array_keys($this->rolePermissions) as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        DB::transaction(function () {
            foreach ($this->modules as $module) {
                $this->seedModule($module, null, null);
            }
        });

        $this->generatePermissions();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $superAdmin = Role::findByName('super-admin', 'web');
        $superAdmin->syncPermissions(Permission::where('guard_name', 'web')->get());

        foreach ($this->rolePermissions as $roleName => $slugActions) {
            $role = Role::findByName($roleName, 'web');
            $permissionNames = [];
            foreach ($slugActions as $slug => $actions) {
                foreach ($actions as $action) {
                    $permissionNames[] = "{$slug}-{$action}";
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
    private function seedModule(array $module, ?string $parentSlug, ?int $parentId): void
    {
        // A 'flat' child keeps its own key as its slug even though it's
        // nested under a section header for display grouping — used for
        // Organization's children so re-parenting Vendors doesn't rename
        // its long-established vendors-* permission (and everywhere in the
        // app that checks it).
        $usesParentSlug = $parentSlug && empty($module['flat']);
        $slug = $usesParentSlug ? "{$parentSlug}-{$module['key']}" : $module['key'];

        if (isset($module['children'])) {
            $parent = $this->section($slug, $module['name'], $module['sort_order'], $module['icon'] ?? null, $parentId);
            Log::info("Seeding menu item: {$slug} ({$module['name']})");

            foreach ($module['children'] as $child) {
                $this->seedModule($child, $slug, $parent->id);
            }
        } else {
            Log::info("Seeding menu item: {$slug} ({$module['name']})");
            $this->upsert($slug, [
                'name'       => $module['name'],
                'route_name' => $module['route_name'],
                'icon'       => $module['icon'] ?? null,
                'sort_order' => $module['sort_order'],
                'parent_id'  => $parentId,
            ]);
        }
    }

    private function upsert(string $slug, array $attrs): Menu
    {
        $menu = Menu::firstOrNew(['slug' => $slug]);
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
     * For every navigable menu (has a route), create its 4 CRUD permissions
     * named "{slug}-view", "{slug}-create", "{slug}-edit", "{slug}-delete".
     */
    private function generatePermissions(): void
    {
        $slugs = Menu::whereNotNull('route_name')->pluck('slug');

        foreach ($slugs as $slug) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                Permission::firstOrCreate([
                    'name'       => "{$slug}-{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }
    }

    private function section(string $slug, string $name, int $sortOrder, ?string $icon = null, ?int $parentId = null): Menu
    {
        $menu = Menu::firstOrNew(['slug' => $slug]);
        $menu->fill([
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
