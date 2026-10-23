# Authentication & Multi-Tenancy

## Two completely separate identities

MyBiz2Flow has two kinds of logged-in user, and they never overlap:

| | Tenant user | Platform admin |
|---|---|---|
| Model | `App\Models\Administration\User` | `App\Models\SystemAdmin` |
| Guard | `sanctum` (provider: `users`) | `platform` (provider: `system_admins`) |
| Login endpoint | `POST /auth/login` | `POST /platform/login` |
| Sees | Only their own company's data | Every tenant company |

Both guards use Sanctum's token driver, but each token is bound to a specific provider model. A tenant user's bearer token is **rejected outright** by any `platform.*`-protected route, and a platform admin's token is rejected by the tenant routes — there's no code path where a token issued for one identity can be replayed against the other.

## Tenant data isolation

This is the part that makes "log in as Company 2, only ever see Company 2's rows" work automatically, everywhere, without each controller having to remember to filter:

### 1. Every tenant-owned model carries a `company_id`

`User`, `Customer`, `Lead`, `Quotation`, `Invoice`, `Expense`, `Item` — all of them.

### 2. `BelongsToCompany` trait (`app/Models/Concerns/BelongsToCompany.php`)

Applied to every tenant-owned model. It does two things via Eloquent's `booted()` hooks:

- **Registers a global scope** (`CompanyScope`) that runs on *every* query against that model — `all()`, `find()`, `where()`, everything.
- **Stamps `company_id` on create**, from the current tenant context — and ignores any `company_id` the request body tried to set.

### 3. `CompanyScope` (`app/Models/Scopes/CompanyScope.php`)

The actual filter. On every query it applies `WHERE {table}.company_id = {current tenant id}` — unless the caller is a platform super-admin (unrestricted) or there's no tenant context at all (trusted internal code: artisan commands, queue workers, seeders — also unrestricted, since there's nothing to scope by).

If somehow authenticated with no company at all, it fails closed (`WHERE 1 = 0`) rather than risk leaking rows.

### 4. `Tenant` (`app/Support/Tenant.php`)

The single source of truth for "what company am I scoped to right now." `Tenant::id()` reads `company_id` straight off the authenticated user (`AuthUser::user()?->company_id`) — **never** from anything the frontend sends. A `set()`/`forget()` override exists only for trusted internal contexts (console commands acting on behalf of a specific company).

### Net effect

Because the scope lives on the model rather than in each controller:

- A new endpoint can't forget to filter by tenant — it's already impossible to bypass without deliberately dropping to raw SQL.
- Tampering with an `{id}` in a URL (`GET /customers/47`) can't leak another tenant's row — the scoped query simply won't find it, so it 404s instead of returning data.
- Creating a record can't be tricked into landing in the wrong company by passing a different `company_id` in the payload — it's overwritten server-side.

## Subscription gating

`CheckSubscriptionStatus` middleware sits on every tenant route (alongside `auth:sanctum`) and blocks access once a company's subscription is expired/cancelled — except for the subscription/plan endpoints themselves, so a blocked tenant can still see their usage and pick a new plan.

## Roles vs. permissions

Tenant authorization is two layers:

1. **Roles** (`spatie/laravel-permission`) — `owner`, `admin`, `sales`, `accountant`, `staff` (plus the platform-only `super-admin`). Some routes are gated directly by role (e.g. only `admin|owner` can manage other users; only `owner|admin|accountant|demo` can view reports).
2. **Granular permissions** — `{slug}-{action}` pairs (e.g. `crm-leads-view`, `sales-invoices-edit`) generated automatically for every navigable menu item. CRM/Sales/Products/Expenses endpoints are gated by these via Policies, not by role directly, so a role's actual access always matches what's configured in `MenuSeeder`'s `$rolePermissions` map — see [Roles, Permissions & Menus](./04-roles-permissions-and-menus.md).
