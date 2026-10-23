# Phase 1 — Architecture, Roles, Data Model & UI Structure

**Project:** Multi-Vendor Vehicle Rental Marketplace (Sri Lanka)
**Base:** the existing Laravel + Next.js multi-tenant codebase (chicken-shop / MyBiz2Flow)
**Currency:** LKR only · **Status:** design — no implementation code yet

Decisions locked for this phase:

| # | Decision | Chosen |
|---|---|---|
| 1 | Tenancy naming | Rename `companies`→`rental_shops`, `company_id`→`shop_id`, `CompanyScope`→`ShopScope`, `Tenant`→`VendorContext` |
| 2 | Legacy modules | Delete all chicken-shop domain modules; keep Expenses + Categories repurposed as per-vehicle running costs |
| 3 | Payments | PayHere (LKR) + **manual** owner settlement with payout records, evidence and reconciliation |
| 4 | SaaS billing | Drop plans/subscriptions and `CheckSubscriptionStatus`; platform revenue = booking commission |

---

## 1. What we keep, what we delete

The existing codebase is a *multi-tenant* SaaS: isolated companies, each seeing only its own rows. A marketplace is the same isolation mechanism **plus a public shared catalogue**. The isolation machinery is the single most valuable thing to inherit; the chicken-shop domain is worthless to us.

### 1.1 Keep — the common spine (reused essentially unchanged)

| Area | Files | Role in the marketplace |
|---|---|---|
| Two-guard auth | `config/auth.php`, `AuthService`, `PlatformAuthService`, `AuthUser`, `ImpersonationService` | Users (customers/owners/staff) vs platform super-admins stay separate identities. A customer token can never hit a platform route. |
| Tenant isolation | `BelongsToCompany`, `CompanyScope`, `Support/Tenant` | Renamed to `BelongsToShop` / `ShopScope` / `VendorContext` — becomes shop-boundary enforcement. This is our IDOR defence. |
| RBAC + data-driven nav | `spatie/laravel-permission`, `Administration\Menu`, `MenuRepo::getNavigation`, `MenuSeeder`, `CheckPermission`, `Header.jsx`, `Sidebar.jsx`, `usePermission`, `Can.jsx` | Extended with an `audience` column → three nav trees (customer, vendor, platform) rendered by the same components. |
| Attachments | `attachments` table (polymorphic + `document_type`), `AttachmentController`, `AttachmentRepo`, `AttachmentPanel.jsx`, `Helpers/Media` | Vehicle photos, KYC documents, inspection photos, payout evidence. Gains a `visibility` column — KYC and payout files must never be publicly reachable. |
| Audit trail | `audit_logs`, `AuditService` | Already has `user_id` + `system_admin_id`. Extended with `shop_id`, `before`/`after` JSON, `severity`. |
| Locations | `locations` (already carries lat/lng + branch details), `LocationRepo`, `MapPicker.jsx`, `GoogleMapPicker.jsx` | Shop branches and vehicle pickup/return points. |
| Expenses | `Expense`, `ExpenseCategory` + controllers/repos/pages | Repurposed: per-vehicle running costs (fuel, service, insurance, licence) so owner profit reporting is real. Gains `vehicle_id`. |
| Platform ops | `PlatformDetail` (branding), `Automation` (scheduled tasks), `BackupController`, `LogController` | `automations` becomes the home of our expiry / hold-release / payout sweeps. |
| Numbering | `Support/NumberGenerator` (row-locked sequential numbers) | Booking references and payout references. Already concurrency-safe. |
| Shared plumbing | `BaseRepository`, `Traits/JsonResponse`, `Exports/ArrayExport`, `Mail/DocumentMail`, `Support/Html`, `lib/pdf.js` | Rental agreement PDF, CSV exports, transactional mail. |
| Frontend kit | all of `components/ui`, `components/shared`, `components/Datatable`, `components/forms`, `hooks/`, `lib/axios`, `store/` | ~60 components reused as-is. `Stepper.jsx` drives the owner-onboarding wizard; `DateRangePicker` drives booking dates. |

### 1.2 Delete — chicken-shop domain

**Backend models:** `Customer`, `Item`, `ItemDailyPrice`, `Unit`, `Vendor`, `Purchase`, `PurchaseItem`, `PurchasePayment`, `Sale`, `SaleItem`, `SalePayment`, `Plan`, `Subscription`

**Controllers:** `Api/CustomerController`, `ItemController`, `ItemDailyPriceController`, `UnitController`, `VendorController`, `PurchaseController`, `SaleController`, `ReportController` (rewritten), `Dashboard/DashboardController` (rewritten), `Platform/PlanController`, `Platform/SubscriptionController`

**Repositories:** `CustomerRepo`, `ItemRepo`, `UnitRepo`, `VendorRepo`, `PurchaseRepo`, `SaleRepo`

**Request dirs:** `Requests/Customer`, `Item`, `Unit`, `Vendor`, `Purchase`, `Sale`

**Services / support:** `SubscriptionService`, `ReportService` (rewritten), `DashboardService` (rewritten), `Support/DocumentTotals` (sale/purchase line math — booking pricing is a different calculation)

**Middleware:** `CheckSubscriptionStatus`, `EnsureModuleEnabled` (plan-gated module toggles)

**Seeders:** `ChickenShopDemoSeeder`, `PlanSeeder`

**Frontend pages:** `(dashboard)/customers`, `/products`, `/products/price-history`, `/units`, `/vendors`, `/purchases/**`, `/sales/**`, `/reports/**`, `app/pos`, `app/pos_bk`, `platform/plans`, `platform/subscriptions`

**Frontend services:** `customerService`, `itemService`, `itemDailyPriceService`, `unitService`, `vendorService`, `purchaseService`, `saleService`

**Dead files found while surveying (delete regardless):** `components/layout/Sidebar1.jsx`, `Sidebar2.jsx`, `Sidebar3.jsx`, `Sidebar-copy.jsx`, the five `(auth)/login-preview/*` pages, `frontend/backups/`, and `backend/_serve_restore.log` (a 1.6 MB log file sitting in the repo).

**`customers` table is deleted, not renamed.** In a marketplace the renter is a `users` row, not a per-vendor contact record. A shop learns a renter's details only through a booking it owns.

**Migrations:** there is no production data, so Phase 1 squashes to a clean baseline rather than stacking ~30 drop-migrations on top of the chicken-shop history.

---

## 2. Architecture — three surfaces, one codebase

```
┌──────────────────────────────────────────────────────────────────────┐
│ PUBLIC MARKETPLACE            no auth · read-only · cached           │
│ app/(public)      ->  routes/public.php                              │
│ home · search · vehicle detail · shop profile · categories           │
│ Only ever sees: published vehicles of active + verified shops        │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ ACCOUNT APP                   auth:sanctum (users guard)             │
│ app/(account)  — customer face: bookings, favourites, disputes       │
│ app/(vendor)   — owner/staff face: listings, requests, finance       │
│ routes/api.php                                                       │
│ One login. Which faces a user sees depends on the roles they hold.   │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ PLATFORM ADMIN                platform guard (system_admins)         │
│ app/platform   ->  routes/platform.php                               │
│ verification · moderation · commission · payouts · disputes          │
└──────────────────────────────────────────────────────────────────────┘
```

Request flow on the vendor side — four independent checks, any one of which stops a cross-shop access:

```
Next.js (axios: Bearer token + X-Shop-Id header)
   |
   v  1. auth:sanctum                    -- who are you?
   v  2. ResolveShopContext middleware   -- are you a member of that shop?
   |                                        (validates X-Shop-Id against shop_members;
   |                                         403 otherwise)
   v  3. Controller -> Action / Service
   |       +- ShopScope global scope     -- WHERE shop_id = <resolved context>
   |                                        (an IDOR attempt 404s, it does not leak)
   v  4. Policy + ShopGate ability check -- may THIS member do THIS action?
   v  Eloquent -> MySQL  (+ append-only ledger + audit log on money/admin actions)
```

### 2.1 The one real change to the tenancy mechanism

Today `users.company_id` is a single column, so a user belongs to exactly one tenant. That directly contradicts *"a person can be both a customer and an owner without creating duplicate accounts"* and *"rental shops may have multiple staff"* — a user may legitimately be a customer, own one vehicle personally, and be staff at two shops.

So:

- **`users.shop_id` is removed.** Membership moves to a `shop_members` pivot (user ↔ shop, with a role and a JSON ability set).
- **`VendorContext::shopId()`** no longer reads a column off the user. It resolves the *active* shop from an `X-Shop-Id` request header — **validated against the caller's `shop_members` rows on every request**. If the user has exactly one membership the header is optional. An unvalidated header here would be the single worst vulnerability in the system, so resolution lives in one middleware with one code path and nothing else may set the context.
- `ShopScope` is otherwise identical to today's `CompanyScope`, including its fail-closed `WHERE 1 = 0` branch and its unrestricted branch for console / queue / seeder contexts.

### 2.2 Public reads deliberately bypass the scope

A shop-scoped global scope is exactly wrong for the public catalogue. Rather than letting controllers sprinkle `withoutGlobalScope()` around, public reads go through dedicated read models:

```php
PublicVehicleQuery::search($filters)          // withoutGlobalScope(ShopScope)
    ->where('vehicles.status', 'published')
    ->where('vehicles.moderation_status', 'approved')
    ->whereHas('shop', fn ($q) => $q->where('status', 'active')
                                    ->where('is_published', true))
    ->select([/* public columns only */]);
```

Two rules, enforced by a test rather than by convention:

1. `withoutGlobalScope(ShopScope)` appears **only** inside `App\Queries\Public*`.
2. Public responses are shaped by `Http/Resources/Public/*` with an explicit column allow-list — never `$model->toArray()`. `registration_number`, owner NIC, bank details, customer contact data and verification documents are structurally absent from those resources.

---

## 3. Identity & ownership model

### 3.1 Every vehicle belongs to exactly one shop

The requirement says a vehicle belongs to "one authorized owner **or** rental shop". Modelling that as a polymorphic owner would mean two ownership code paths, two authorization paths, and two sets of bugs.

Instead: **an approved individual owner is auto-provisioned a personal shop** with `shop_type = individual`. One FK — `vehicles.shop_id` — covers both cases, and every authorization check, scope, payout and report then has exactly one shape.

```
users ---1:1--> owner_profiles          (identity + KYC + approval state)
  |               +--1:N--> owner_verifications --> attachments (private)
  |
  +---1:1--> customer_profiles          (driving licence, NIC — needed to rent)
  |
  +---M:N--> rental_shops   via  shop_members (role + JSON abilities)
                 |
                 +--1:1--> shop_settings         (prefixes, deadlines, policies)
                 +--1:N--> shop_verifications --> attachments (private)
                 +--1:N--> locations             (branches / pickup points)
                 +--1:1--> owner_bank_details    (encrypted, restricted)
                 +--1:N--> vehicles
                              +--1:N--> vehicle_images --> attachments (public)
                              +--1:1--> vehicle_pricing
                              +--1:N--> vehicle_pickup_locations --> locations
                              +--1:N--> vehicle_availability   (one row per date)
                              +--1:N--> reservation_holds
                              +--1:N--> listing_moderation_history
                              +--1:N--> bookings
```

### 3.2 Booking is the join between the two sides

```
bookings
  +- vehicle_id   -> vehicles
  +- shop_id      -> rental_shops   (denormalised: lets ShopScope filter without a join)
  +- customer_id  -> users
  +--1:1--> booking_pricing        (immutable quote snapshot)
  +--1:1--> booking_financials     (mutable settlement view)
  +--1:1--> security_deposits
  +--1:N--> booking_extras
  +--1:N--> booking_status_histories
  +--1:N--> booking_inspections --1:N--> booking_damages
  +--1:N--> payments --1:N--> refunds
  +--1:1--> reviews                (one per completed booking, enforced by a unique key)
  +--1:N--> disputes --1:N--> dispute_messages
  +--1:1--> owner_payout_items --> owner_payouts
```

`shop_id` on `bookings` is denormalised on purpose: without it, every vendor booking query needs a join to `vehicles` for the scope to bite, and a scope that depends on a join is a scope that can be forgotten.

### 3.3 Why pricing and financials are two tables

- **`booking_pricing`** — what we quoted the customer. Written once at request time, never updated. It includes a full JSON copy of `vehicle_pricing` as it stood, so an owner editing their rates tomorrow cannot change what an existing booking owes. This is the required "snapshot of the requested price breakdown".
- **`booking_financials`** — what money actually moved: collected, commission, fees, refunds, adjustments, owner payable, settlement status. Updated as payments, refunds and payouts happen.

Collapsing these into one table is the classic marketplace mistake: you lose the ability to prove what was promised versus what was settled.
