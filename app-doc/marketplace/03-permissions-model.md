# Phase 1 — Roles & Permissions Model

Four layers. Each one is independent, so a bug in one does not open the system.

```
Layer 0  Guard          users (sanctum)  vs  system_admins (platform)
Layer 1  Role           what KIND of actor you are, marketplace-wide        (spatie, additive)
Layer 2  Shop context   WHICH shop you are acting for right now             (shop_members)
Layer 3  Ability        what you may DO at that shop                        (shop_members.abilities)
```

---

## Layer 0 — Guards

Unchanged from the existing app and the reason it was worth inheriting. `users` and `system_admins` are different tables on different Sanctum providers. A customer/owner token is rejected outright by every `platform/*` route, and a platform admin token is rejected by the account app. There is no code path where one replays as the other. `AuthUser::user()` already hard-checks `instanceof User` to prevent cross-guard confusion.

---

## Layer 1 — Roles (spatie, `web` guard) — additive, never exclusive

| Role | Granted when | Marketplace-wide capability |
|---|---|---|
| `customer` | on registration, to **everyone** | browse, favourite, request bookings, pay, review, raise disputes |
| `vehicle-owner` | `owner_profiles.status` becomes `approved` for an individual applicant | create/manage their own personal shop and its vehicles |
| `shop-owner` | a business `rental_shop` is approved | create/manage that shop, its vehicles and its staff |
| `shop-staff` | an invited `shop_members` row is accepted | act for a shop, limited by Layer 3 |
| `super-admin` | platform only | bypasses every permission check (existing behaviour, kept) |

**Additive is the whole point.** One `users` row can hold `customer` + `vehicle-owner` + `shop-staff` simultaneously. That is the required *"a person can be both a customer and an owner without creating duplicate accounts"*, and it falls out for free because spatie roles are a pivot, not a column.

The old tenant roles (`owner`, `admin`, `sales`, `accountant`, `staff`) are dropped — they described positions inside one company, which is now Layer 3's job.

**A role never, on its own, grants access to a row.** `vehicle-owner` means "may own vehicles", not "may see vehicle 47".

---

## Layer 2 — Shop context

Because a user may belong to several shops, "which shop am I acting as" cannot come from a column on `users`. It comes from the request, and is therefore **untrusted until validated**.

```php
final class ResolveShopContext           // middleware: 'shop.context'
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = AuthUser::user() ?? abort(401);

        $memberships = $user->activeShopMemberships();            // cached per request

        $requested = $request->header('X-Shop-Id');

        $membership = $requested
            ? $memberships->firstWhere('shop_id', (int) $requested)
            : ($memberships->count() === 1 ? $memberships->first() : null);

        abort_if($requested && ! $membership, 403, 'Not a member of this shop.');
        abort_if(! $membership, 400, 'Active shop not specified.');
        abort_if($membership->shop->status === 'suspended', 403, 'Shop suspended.');

        VendorContext::set($membership->shop_id, $membership);     // feeds ShopScope + ShopGate
        return $next($request);
    }
}
```

Non-negotiables:

- `X-Shop-Id` is **only** ever read here. No controller, service or model reads it.
- Nothing else may call `VendorContext::set()` outside this middleware and trusted console/queue/seeder contexts.
- `VendorContext::shopId()` is the sole input to `ShopScope`.
- A suspended shop fails at the boundary, so no downstream code needs to remember to check.

`ShopScope` then applies `WHERE {table}.shop_id = <context>` to every query on every shop-owned model — `vehicles`, `bookings`, `payments` (via booking), `owner_payouts`, `locations`, `expenses`, `shop_members`, `reviews`. Tampering with an `{id}` in a URL produces a 404, not a leak. Creating a row stamps `shop_id` server-side and ignores any `shop_id` in the request body. This is inherited behaviour that already works; only the names change.

---

## Layer 3 — Shop-scoped abilities

Spatie permissions are global per user. They **cannot** express *"staff member X may respond to bookings at shop A but not at shop B"* — which is exactly what the requirements ask for. So shop-level abilities live on the membership row (`shop_members.abilities` JSON) and are checked through one gate:

```php
ShopGate::allows($user, $shopId, 'bookings.respond');   // or: $this->authorize('respond', $booking)
```

### Ability catalogue

| Group | Abilities |
|---|---|
| Bookings | `bookings.view` · `bookings.respond` · `bookings.cancel` · `bookings.modify` |
| Listings | `listings.view` · `listings.create` · `listings.edit` · `listings.publish` · `listings.archive` |
| Pricing & calendar | `pricing.manage` · `availability.manage` |
| Operations | `handover.conduct` · `returns.conduct` · `damage.record` · `inspections.view` |
| Finance | `finance.view` · `payouts.view` · `bank_details.manage` |
| Shop | `shop.settings` · `locations.manage` · `staff.manage` · `staff.view` |
| Engagement | `reviews.reply` · `inquiries.respond` |
| Reporting | `reports.operational` · `reports.financial` |

### Role presets (seeded into `abilities` on invite; editable per member)

| Ability | `owner` | `manager` | `staff` |
|---|:--:|:--:|:--:|
| bookings.view / respond / cancel | ✔ | ✔ | view + respond |
| listings.create / edit / publish / archive | ✔ | ✔ | — |
| pricing.manage | ✔ | ✔ | — |
| availability.manage | ✔ | ✔ | ✔ |
| handover / returns / damage | ✔ | ✔ | ✔ |
| finance.view | ✔ | ✔ | — |
| payouts.view | ✔ | view only | — |
| bank_details.manage | ✔ | — | — |
| staff.manage | ✔ | — | — |
| shop.settings | ✔ | ✔ | — |
| reviews.reply / inquiries.respond | ✔ | ✔ | ✔ |
| reports.financial | ✔ | ✔ | — |
| reports.operational | ✔ | ✔ | ✔ |

A shop's `owner` membership cannot be removed or downgraded by anyone but the platform — otherwise a manager could lock the owner out.

---

## Platform admin roles (`system_admins.admin_role`)

Separation of duties on the money and moderation paths:

| Admin role | May do |
|---|---|
| `platform_owner` | everything, plus manage admins, backups, platform settings, destructive ops |
| `admin` | verification, moderation, booking oversight, categories, read-only finance |
| `finance` | commission rules, build/approve payouts, record settlement evidence, approve refunds, reconciliation |
| `moderator` | listing moderation, review moderation, abuse reports, suspensions |
| `support` | disputes, customer/owner assistance, impersonation (already audited) |

Every action by any of these writes an `audit_logs` row with `before`/`after` JSON. Payout approval, payout payment, refund approval, commission changes, account suspension and impersonation are marked `severity = critical`.

---

## The navigation menu becomes three trees

`MenuSeeder` already generates the menu tree, the four CRUD permissions per navigable node, and the role→permission map. That machinery is kept verbatim; the `menus` table gains an **`audience`** column (`customer` | `vendor` | `platform`), and `MenuRepo::getNavigation()` filters by:

1. the caller's audience,
2. spatie `{slug}-view` permission (existing logic), and
3. for `vendor` nodes, the required `ShopGate` ability on the active shop.

`Header.jsx` and `Sidebar.jsx` need no changes — they render whatever tree they are handed. The frontend route whitelist in `layout.jsx` keeps working as the UX safety net, with real enforcement still server-side.

---

## Enforcement checklist applied to every endpoint

The requirements list security rules; here is where each one actually lives.

| Requirement | Mechanism |
|---|---|
| Ownership checks on every vehicle/listing/booking/financial endpoint | `ShopScope` (automatic) + a Policy per model |
| Prevent IDOR | scoped queries 404 on foreign ids; public resources use column allow-lists |
| Validate booking decisions on the backend | `AcceptBookingAction` re-reads the booking, re-checks `shop_id`, re-checks availability; the request body carries only a decision and a reason |
| Customers cannot change prices or commission | price comes from `booking_pricing` (server-computed, hashed); commission comes from `platform_commissions`; neither is ever accepted from a request |
| Verify webhooks, process idempotently | signature check + `unique(gateway, event_id)` on `payment_webhook_events` |
| Reconcile payments and payouts | scheduled reconciliation job + `ledger_entries` |
| Protect against concurrent bookings | `lockForUpdate` on the vehicle row + `unique(vehicle_id, date)` on `vehicle_availability` |
| Complete auditable financial history | append-only `ledger_entries`; no update/delete path |
| Record status changes | `booking_status_histories`, `listing_moderation_history`, payout status audit rows |
| Restrict owner/shop/customer data | `ShopScope`, API Resources, private attachment disk + signed URLs, `owner_bank_details` returning only `last4` |
| RBAC at service and policy level | Layers 1–3 above, checked in Policies, not in controllers |

### An owner cannot accept a booking they do not manage

Four things would each have to fail for that to happen:

1. `ResolveShopContext` would have to accept an `X-Shop-Id` the user has no `shop_members` row for.
2. `ShopScope` would have to not append `WHERE bookings.shop_id = <context>` (so the booking would not even be found).
3. `BookingPolicy::respond()` would have to skip its `$booking->shop_id === VendorContext::shopId()` assertion.
4. `ShopGate` would have to grant `bookings.respond` to a member without it.
