# Vehicle Rental Marketplace — Design Docs

Multi-vendor vehicle rental marketplace for Sri Lanka, built on the existing Laravel + Next.js codebase.

**Phase 1 is design only — no implementation code has been written yet.** Read `01` through `06` in order, then approve or amend before Phase 1 implementation begins.

| Doc | Contents |
|---|---|
| [01 — Architecture](./01-phase1-architecture.md) | What we keep from the chicken-shop app and what we delete · the three surfaces (public marketplace / account app / platform admin) · the one change to the tenancy mechanism · the ownership model |
| [02 — Data Model](./02-data-model.md) | All ~45 tables with columns, indexes, constraints, and PII / public-visibility markers |
| [03 — Permissions Model](./03-permissions-model.md) | Guards → roles → shop context → abilities · ability catalogue · role presets · requirement-to-mechanism map |
| [04 — Lifecycles](./04-lifecycles.md) | Booking state machine · concurrency control · payment lifecycle and webhook idempotency · commission calculation · payout cycle |
| [05 — UI & API Map](./05-ui-and-api-map.md) | Every page across the four surfaces · the full API surface · the response-shaping rule |
| [06 — Plan & Risks](./06-plan-and-risks.md) | Phase 1 build order · open business questions · risks and mitigations |

## Decisions locked

| Decision | Chosen |
|---|---|
| Tenancy naming | `companies` → `rental_shops`, `company_id` → `shop_id`, `CompanyScope` → `ShopScope`, `Tenant` → `VendorContext` |
| Legacy modules | Delete all chicken-shop domain modules; keep Expenses repurposed as per-vehicle running costs |
| Payments | PayHere (LKR) + manual owner settlement with payout records, evidence and reconciliation |
| SaaS billing | Drop plans / subscriptions; platform revenue is booking commission only |

## The four ideas that shape everything else

1. **An individual owner gets an auto-provisioned personal shop.** So `vehicles.shop_id` is the single ownership FK, and every authorization check, scope, payout and report has exactly one shape instead of two.
2. **`users.shop_id` is removed; membership moves to `shop_members`.** That is what lets one account be a customer, an owner and staff at two shops at once — the requirement's "no duplicate accounts" falls out for free.
3. **`booking_pricing` and `booking_financials` are separate tables.** One is the immutable quote; the other is what money actually moved. Merging them loses the ability to prove what was promised versus what was settled.
4. **Double-booking protection is both a row lock and a unique index.** The lock gives a clean 409; `unique(vehicle_id, date)` means a future code path that forgets the lock still cannot double-book.

## Phases

- **Phase 1** — architecture, roles, data model, UI structure ← *this folder*
- **Phase 2** — auth, customer accounts, owner onboarding, shop registration, verification
- **Phase 3** — vehicle listings, photos, categories, availability, public search
- **Phase 4** — booking requests, owner decisions, pricing snapshots, reservation holds
- **Phase 5** — payments, commission, refunds, payout reconciliation
- **Phase 6** — customer / owner / shop-staff / platform dashboards
- **Phase 7** — reviews, reports, notifications, inspections, maintenance
- **Phase 8** — security, concurrency and reconciliation tests, deployment
