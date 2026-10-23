# Roles, Permissions & Menus

The sidebar/top-nav isn't hardcoded in the frontend — it's data, generated from `database/seeders/MenuSeeder.php`, filtered per-user by permission, and rendered generically by `Header.jsx` / `Sidebar.jsx`.

## The menu tree is the single source of truth

`MenuSeeder.php` defines a `$modules` array — a tree of module definitions:

```php
[
    'key' => 'crm',
    'name' => 'CRM',
    'icon' => 'UsersRound',
    'sort_order' => 2,
    'children' => [
        ['key' => 'leads', 'name' => 'Leads', 'route_name' => '/leads', 'icon' => 'Target', 'sort_order' => 1],
        ['key' => 'customers', 'name' => 'Customers', 'route_name' => '/customers', 'icon' => 'Contact', 'sort_order' => 2],
        ...
    ],
],
```

Rules:

- A node **with `children` and no `route_name`** is a *parent module* — it becomes one of the colored tabs in the top `Header` (CRM, Sales, Products & Services, Expenses, Reports, Settings), and its children become the tile grid in the `Sidebar` once that tab is active.
- A node **with a `route_name` and no children** is a stand-alone page (e.g. `Dashboard`) — rendered as a tile directly, not behind a parent tab.
- The seeder recursively `slug`s each node by joining ancestor keys, e.g. `admin` → `admin-users`. This slug is what permissions are generated against.

On `db:seed --class=MenuSeeder`, the seeder truncates and rebuilds `menus`, `permissions`, `role_has_permissions`, and `model_has_permissions` from this array — it's meant to be edited and re-run as the canonical way to change navigation structure, not hand-edited via SQL. (There is also a live "Menus" CRUD screen at `/menus` for ad-hoc changes without a redeploy, but the seeder is what ships with the codebase.)

## Permission generation

For every menu node that has a `route_name`, four permissions are auto-created: `{slug}-view`, `{slug}-create`, `{slug}-edit`, `{slug}-delete`. So `Leads` (`slug = crm-leads`) gets `crm-leads-view`, `crm-leads-create`, `crm-leads-edit`, `crm-leads-delete`.

## Role → permission mapping

Also in `MenuSeeder.php`, a `$rolePermissions` array explicitly lists which `{slug}-{action}` pairs each role gets:

```php
'sales' => [
    'crm-leads'        => ['view', 'create', 'edit', 'delete'],
    'crm-customers'    => ['view', 'create', 'edit'],
    'sales-invoices'   => ['view', 'create'],
    ...
],
```

This is the **single file to check or edit** when you need to know or change "what can role X do." Roles: `owner`, `admin` (both effectively run the company), `sales`, `accountant`, `staff`. `super-admin` is platform-only and is synced *every* permission that exists (bypasses this map entirely).

## How the frontend nav is built

1. On load, `(dashboard)/layout.jsx` calls `useNavigationMenu()`, which hits `GET /menus/navigation`.
2. `MenuController::navigation()` → `MenuRepo::getNavigation($user)`:
   - Loads every active menu.
   - Section headers (no `route_name`) are always kept.
   - Navigable items require `{slug}-view` — kept only if the permission doesn't exist, or the user has it.
   - Builds the tree, then drops any parent section left with zero children (so an empty module tab never renders).
3. `Header.jsx` renders one tab per item that has `children` and no `route_name`. `Sidebar.jsx` renders the *active* module's children as a tile grid (or a collapsible nested list for a child that itself has children, like Settings' sub-items).
4. `layout.jsx` also flattens the returned tree into a route whitelist (`flattenRoutes`) — if the current URL isn't in it, the page renders an `UnauthorizedView` instead of the page content. This is a UX safety net; the *real* enforcement is still server-side (the permission check on the API call itself).

## Practical implication

Adding a genuinely new module (not just a new field on an existing page) means:

1. Add it to `$modules` in `MenuSeeder.php` (with `children` if it should be a top-nav tab).
2. Add its slug to whichever roles should see it in `$rolePermissions`.
3. Re-run `php artisan db:seed --class=MenuSeeder`.
4. Build the actual Next.js page(s) at the `route_name` path(s) — the nav will only ever link to routes that already have a `page.jsx`, the seeder doesn't create pages.

This is exactly the pattern used to add the Reports module as a proper parent tab with five child report pages (see `app-doc/05-business-modules.md#reports`).
