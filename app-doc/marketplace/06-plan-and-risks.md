# Phase 1 — Build Order, Open Questions & Risks

## 1. What Phase 1 implements once this design is approved

In this order, because each step depends on the one before it.

| Step | Work | Touches |
|---|---|---|
| 1 | **Strip the chicken shop.** Delete the models, controllers, repos, requests, services, middleware, seeders, frontend pages and services listed in `01-phase1-architecture.md §1.2`. Delete the dead `Sidebar1/2/3/-copy`, `login-preview/*`, `frontend/backups/`, `backend/_serve_restore.log`. | ~90 files removed |
| 2 | **Rename the tenancy layer.** `companies`→`rental_shops`, `company_settings`→`shop_settings`, `company_id`→`shop_id`; `BelongsToCompany`→`BelongsToShop`, `CompanyScope`→`ShopScope`, `Support/Tenant`→`Support/VendorContext`, `CompanyController`→`ShopController`. Frontend `companyService`→`shopService`. | ~25 files after step 1 |
| 3 | **Squash migrations to a clean baseline.** One ordered set: framework tables, permission tables, menus, attachments, audit logs, platform tables, then the ~45 marketplace tables from `02-data-model.md`. | `database/migrations/*` |
| 4 | **Models + relations.** Every table gets a model with relations, `$casts` (including `encrypted` on NIC / licence / bank account), `$fillable`, `BelongsToShop` where applicable, and enum constants in one place per model. | `app/Models/**` |
| 5 | **Authorization.** `ResolveShopContext` middleware, `VendorContext`, `ShopGate`, the ability catalogue as a PHP enum, and Policy skeletons for Vehicle, Booking, Payout, Review, Dispute, ShopMember, BankDetail. | `app/Http/Middleware`, `app/Support`, `app/Policies` |
| 6 | **Query layer.** `App\Queries\PublicVehicleQuery` / `PublicShopQuery` with the scope-bypass confined there, plus the `Public` / `Vendor` / `Platform` resource namespaces (shapes only, no business logic yet). | `app/Queries`, `app/Http/Resources` |
| 7 | **Menu & role seeding.** `MenuSeeder` rewritten for three audience trees; `RoleSeeder` for the five roles; `AbilityPresetSeeder`; `PlatformSettingSeeder` with the defaults from `02-data-model.md §7`; `VehicleCategorySeeder`. | `database/seeders` |
| 8 | **Route skeletons.** `routes/public.php` created, `api.php` restructured into public / customer / onboarding / vendor blocks, `platform.php` extended — all wired to controllers that exist and return `501` until their phase lands. | `routes/*` |
| 9 | **Frontend scaffolding.** The `(public)`, `(account)`, `(vendor)` route groups with layouts, the `ShopSwitcher`, an audience-aware navigation fetch, and placeholder pages at every path in `05-ui-and-api-map.md`. | `frontend/src/app/**` |
| 10 | **Demo seeder.** Sri Lankan data: 3 shops (Colombo, Kandy, Galle), ~15 vehicles (Toyota Aqua / Premio / KDH, Suzuki Wagon R / Alto, Nissan Caravan, Mitsubishi Montero, a 29-seat minibus), LKR pricing, staff members, customers, and bookings in every lifecycle state. | `database/seeders/MarketplaceDemoSeeder.php` |
| 11 | **Guard-rail tests.** The structural tests that must pass before Phase 2: cross-shop access returns 404; a forged `X-Shop-Id` returns 403; public resources never contain the private columns; `withoutGlobalScope(ShopScope)` appears only in `App\Queries\Public*`; `ledger_entries` has no update path. | `tests/Feature`, `tests/Architecture` |

Phase 1 writes **no** booking, payment or payout business logic — only the structures, boundaries and seams those phases will fill.

---

## 2. Open questions needing a business answer

None of these block Phase 1. Each one blocks the phase named.

| # | Question | Blocks | Default I will build toward |
|---|---|---|---|
| 1 | **Deposit handling.** PayHere has no card pre-authorisation hold, so a security deposit must be either prepaid (collected with the rental, refunded after return) or cash-on-pickup. Prepaid is safer for owners but raises the up-front amount a renter must find. | Phase 5 | Support all three `hold_method` values; default to `prepaid` (previously the business-shop default; all shops are now businesses). |
| 2 | **Rental granularity.** The design uses day-granular availability rows with exact datetimes on bookings. Hourly or half-day rentals would need `vehicle_availability` reworked into slots. | Phase 3 | Day-granular. Half-day/hourly is a later schema change, not a later config flag — worth deciding now. |
| 3 | **Who is the merchant of record?** The platform collecting the full rental and settling owners manually means the platform is the merchant and carries chargeback liability. Confirm the business is set up for that (and for the VAT/SSCL treatment of commission vs. pass-through rental). | Phase 5 | Platform as merchant of record. |
| 4 | **Driver-included rentals.** Modelled as a priced extra (`driver_rate_per_day`). If drivers need their own records, assignment, availability and licence tracking, that is a separate module. | Phase 7 | Priced extra only. |
| 5 | **SMS / WhatsApp notifications.** Booking requests need to reach owners fast; email alone is too slow in practice. Which provider — Text.lk, Dialog, Notify.lk? | Phase 7 | Channel abstraction now, `database` + `mail` implemented, SMS driver pluggable. |
| 6 | **Insurance.** Whether the platform requires proof of comprehensive insurance per vehicle, and whether it offers any coverage product. | Phase 3 (document requirements) | Require an insurance certificate in `shop_verifications`; no platform-offered coverage. |

---

## 3. Risks and how the design addresses them

| Risk | Mitigation |
|---|---|
| **PayHere capability assumptions.** The requirements explicitly say not to assume gateway capabilities. I have designed for manual settlement precisely because sub-merchant splits are not available — but the refunds API, the payment-retrieval API (needed for reconciliation) and the webhook retry policy **must be confirmed against the live merchant account** before Phase 5 starts. If the retrieval API is unavailable, the reconciliation job needs a different input (settlement file import). | Gateway interaction sits behind a `PaymentGateway` interface, so a capability gap changes one driver, not the lifecycle. |
| **Double booking under load.** Row lock + half-open interval revalidation + `unique(vehicle_id, date)` as a database-level backstop. Correctness does not depend on a future developer remembering the lock. | Concurrency tests in Phase 8 fire parallel accept/confirm requests for the same vehicle and dates and assert exactly one wins. |
| **Forged shop context.** `X-Shop-Id` read in exactly one middleware and validated against `shop_members`; `ShopScope` filters anyway; Policies re-assert `shop_id`; abilities checked per member. Four independent failures required. | Guard-rail tests in step 11. |
| **Leaking KYC or bank data.** Documents on a private disk, served only via signed short-lived permission-checked routes with every access audited. `owner_bank_details.account_number` encrypted, and **no endpoint returns it** — only `account_number_last4`. Public resources are allow-lists, so a new column cannot leak by being added to a model. | Resource-shape tests assert the private column names are absent from public payloads. |
| **Webhook replay / double confirmation.** Idempotency is a unique database constraint, not application logic. | — |
| **Price or commission tampering.** Checkout accepts only a booking reference; the amount comes from `booking_pricing`; the gateway hash is computed server-side from it; commission comes from `platform_commissions` and is frozen at confirmation. No request field anywhere accepts a price, a rate or a commission. | — |
| **Paying an owner twice, or paying before the rental happened.** `unique(payout_id, booking_id)`; a booking may sit in at most one non-cancelled payout; payout eligibility requires `status = completed` plus the dispute window; `paid` requires settlement evidence. | — |
| **Counting money that is not revenue.** Deposits post to `deposit_liability`, never to revenue, and are excluded from the commission base and the owner payable until the return inspection decides. Revenue recognises only on `payment_status = paid`. Every dashboard figure reads `booking_financials`, never `bookings`. | Phase 8 includes a reconciliation test asserting the ledger balances and that deposits never appear in a revenue total. |
| **Scope creep in the 92-file rename.** Step 1 (delete) runs before step 2 (rename), so most of those files no longer exist by the time the rename happens. | — |
| **Unverified owners publishing.** Publication requires shop `verification_status = verified` unless the platform setting `allow_unapproved_owner_publishing` is explicitly enabled. It defaults to **false**, exactly as required. | — |

---

## 4. Document index

| File | Contents |
|---|---|
| `01-phase1-architecture.md` | keep/delete inventory · three surfaces · tenancy change · ownership model |
| `02-data-model.md` | all ~45 tables, columns, indexes, constraints, PII and public markers |
| `03-permissions-model.md` | the four authorization layers · ability catalogue · role presets · enforcement map |
| `04-lifecycles.md` | booking state machine · concurrency · payment lifecycle · commission and payout model |
| `05-ui-and-api-map.md` | every page in all four surfaces · full API surface · response-shaping rule |
| `06-plan-and-risks.md` | this file: build order, open questions, risks |

Existing docs that remain accurate after the rename: `app-doc/02-backend-structure.md` (layering), `app-doc/06-frontend-structure.md` (component conventions). `app-doc/03-authentication-and-multi-tenancy.md`, `04-roles-permissions-and-menus.md`, `05-business-modules.md` and `07-database-schema.md` are superseded by this folder and should be rewritten at the end of Phase 1.
