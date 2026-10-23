# Phase 1 — UI Page Map & API Surface

## 1. Next.js route groups

```
frontend/src/app/
├── (public)/                      no auth · SSR + ISR cached
│   ├── page.jsx                               /                       home
│   ├── search/page.jsx                        /search                 results + filters
│   ├── vehicles/[slug]/page.jsx               /vehicles/{slug}        vehicle detail
│   ├── shops/[slug]/page.jsx                  /shops/{slug}           shop profile
│   ├── categories/[slug]/page.jsx             /categories/{slug}      category browse
│   ├── locations/[city]/page.jsx              /locations/{city}       pickup-location browse
│   ├── compare/page.jsx                       /compare?ids=           price comparison
│   ├── become-an-owner/page.jsx               /become-an-owner        owner acquisition
│   └── (static)/how-it-works · terms · privacy · contact
│
├── (auth)/                        existing group, reused
│   ├── login · register · forgot-password · reset-password · verify-email
│
├── (account)/                     auth:sanctum · role customer (everyone)
│   ├── page.jsx                               /account                overview
│   ├── bookings/page.jsx                      /account/bookings       tabs by state
│   ├── bookings/[reference]/page.jsx          /account/bookings/{ref} timeline · breakdown · pay · cancel
│   ├── favorites/page.jsx                     /account/favorites
│   ├── reviews/page.jsx                       /account/reviews        write + history
│   ├── disputes/page.jsx · disputes/[ref]
│   ├── notifications/page.jsx
│   ├── profile/page.jsx                       /account/profile        + driving-licence upload
│   ├── become-owner/page.jsx                  /account/become-owner   onboarding wizard (Stepper.jsx)
│   └── shops/new/page.jsx                     /account/shops/new      shop registration wizard
│
├── (vendor)/                      auth:sanctum · vehicle-owner | shop-owner | shop-staff
│   │                              layout renders the ShopSwitcher when memberships > 1
│   ├── dashboard/page.jsx                     /vendor/dashboard
│   ├── onboarding/page.jsx                    /vendor/onboarding      application status / resubmit
│   ├── vehicles/page.jsx                      /vendor/vehicles
│   ├── vehicles/new/page.jsx                  /vendor/vehicles/new
│   ├── vehicles/[id]/edit/page.jsx            tabs: details · photos · pricing · locations · rules
│   ├── vehicles/[id]/calendar/page.jsx        availability + blocked dates
│   ├── vehicles/[id]/performance/page.jsx     views · bookings · revenue · utilisation
│   ├── bookings/page.jsx                      /vendor/bookings        request queue, accept/reject
│   ├── bookings/[reference]/page.jsx          detail + handover/return/damage actions
│   ├── calendar/page.jsx                      /vendor/calendar        all-vehicle grid
│   ├── inspections/page.jsx
│   ├── finance/earnings/page.jsx              revenue · commission · payable balance
│   ├── finance/payouts/page.jsx · payouts/[reference]/page.jsx
│   ├── finance/bank-details/page.jsx          owner role only
│   ├── expenses/page.jsx                      per-vehicle running costs (repurposed)
│   ├── reviews/page.jsx                       + reply
│   ├── inquiries/page.jsx
│   ├── staff/page.jsx                         invite · permission matrix
│   └── settings/shop · settings/policies · settings/locations
│
└── platform/                      platform guard · existing group, extended
    ├── dashboard                              GMV · bookings · commission · payouts due · queues
    ├── customers · customers/[id]
    ├── owners · owners/[id]                   verification queue · document viewer · approve/reject/request-info/suspend
    ├── shops · shops/[id]
    ├── listings · listings/[id]               moderation queue
    ├── categories
    ├── bookings · bookings/[reference]
    ├── payments · refunds
    ├── commissions                            rule builder (scope · rate · window)
    ├── payouts · payouts/[reference]          build · approve · record evidence
    ├── reconciliation                         gateway vs ledger vs payouts
    ├── disputes · disputes/[reference]
    ├── abuse-reports
    ├── reviews                                moderation
    ├── analytics
    ├── users                                  system admins + admin_role
    ├── audit-logs
    └── settings                               deadlines · holds · tax · commission defaults ·
                                               feature flags · branding · automations · backups · logs
```

Deleted: `app/pos`, `app/pos_bk`, `(dashboard)/{customers,products,units,vendors,purchases,sales,reports}`, `platform/{plans,subscriptions}`, `(auth)/login-preview/*`.

### Key screen compositions (which existing components do the work)

| Screen | Reuses |
|---|---|
| `/search` filters + results | `SearchBar`, `SectionBox`, `Pagination`, `DateRangePicker`, `SelectInput` |
| `/vehicles/{slug}` booking widget | `DateRangePicker`, `Calendar`, `MapPicker`, `StatusBadge`, `RichContent` |
| `/account/become-owner` wizard | `Stepper`, `Fieldset`, `FormField`, `AttachmentPanel` |
| `/vendor/bookings` queue | `ServerDataTable`, `SortableHeader`, `ActionButton`, `ConfirmDialog`, `TableToolbar` |
| `/vendor/dashboard` tiles | `OptionCard`, `tileColors.js`, `recharts` (already a dependency) |
| `/vendor/vehicles/[id]/edit` | `Tabs`, `FormField`, `AttachmentPanel`, `RichTextEditor`, `GoogleMapPicker` |
| `/platform/payouts/[ref]` | `DataTable`, `Modal`, `AttachmentPanel` (evidence upload), `ConfirmDialog` |
| all tables/exports | `ServerDataTable`, `exportCsv.js`, `useTableParams` |

### Owner dashboard tiles (the required set, mapped to data)

| Tile | Source |
|---|---|
| Total / published / unpublished listings | `vehicles` grouped by `status` |
| Available vehicles | vehicles with no `confirmed`/`active` booking spanning today |
| Pending requests | `bookings.status = pending` |
| Awaiting payment | `status = accepted AND payment_status IN (unpaid, initiated, failed)` |
| Confirmed upcoming | `status = confirmed AND pickup_at > now()` |
| Active rentals | `status = active` |
| Completed | `status = completed` |
| Rejected / cancelled / expired | `status IN (rejected, expired, cancelled_*)` |
| Rental revenue | `SUM(booking_financials.gross_rental_amount)` where `payment_status = paid` — **deposits excluded, unpaid bookings excluded** |
| Platform commission | `SUM(commission_amount)` |
| Owner payable balance | `SUM(owner_payable_amount)` where `settlement_status = unsettled` |
| Paid / pending payouts | `owner_payouts` grouped by `status` |
| Vehicle utilisation | booked days ÷ available days over the period, from `vehicle_availability` |
| Listing performance | `view_count`, `inquiry_count`, `booking_count`, conversion |
| Customer reviews | `reviews` where `status = published` |
| Notifications | `notifications` for the member, scoped to the active shop |

---

## 2. API surface

### `routes/public.php` — unauthenticated

```
GET  /public/home                          featured · categories · cities · stats
GET  /public/vehicles                      search: q, category, city, pickup_at, return_at,
                                           price_min, price_max, transmission, fuel, seats_min,
                                           features[], verified_only, delivery, sort, page
GET  /public/vehicles/{slug}               detail (public resource)
GET  /public/vehicles/{slug}/availability  calendar for a month range
GET  /public/vehicles/{slug}/quote         live price breakdown for dates (read-only, not stored)
GET  /public/vehicles/{slug}/reviews
GET  /public/shops/{slug}                  profile
GET  /public/shops/{slug}/vehicles
GET  /public/categories
GET  /public/locations                     cities / pickup points with counts
GET  /public/compare?ids=
POST /public/inquiries                     rate-limited
GET  /platform-details                     existing branding endpoint

POST /webhooks/payhere                     signature-verified · idempotent · CSRF-exempt
```

### `routes/api.php` — `auth:sanctum`

```
# auth & profile (existing, kept)
POST   /auth/login · register · logout      GET /auth/me
PUT    /auth/profile · /auth/change-password
POST   /auth/verify-email · /auth/verify-phone

# customer
GET    /customer/profile            PUT /customer/profile
POST   /customer/licence                      upload driving licence
GET    /favorites                   POST /favorites/{vehicle}   DELETE /favorites/{vehicle}
GET    /bookings                              own bookings
POST   /bookings                              submit a request  -> pending
GET    /bookings/{reference}
POST   /bookings/{reference}/cancel
POST   /bookings/{reference}/checkout         -> gateway payload (amount server-side only)
GET    /bookings/{reference}/agreement.pdf
GET    /bookings/{reference}/payments
POST   /reviews                               only for a completed, unreviewed booking
GET    /disputes   POST /disputes   POST /disputes/{ref}/messages
GET    /notifications   POST /notifications/{id}/read
POST   /reports                               abuse / fraud

# owner onboarding (no shop context required)
GET    /onboarding/owner            POST /onboarding/owner        save draft
POST   /onboarding/owner/documents  POST /onboarding/owner/submit
GET    /onboarding/shops            POST /onboarding/shops        register a business shop
GET    /my-shops                              membership list -> feeds the ShopSwitcher

# vendor — all of the below additionally require: shop.context  (X-Shop-Id validated)
GET    /vendor/dashboard
GET    /vendor/shop                 PUT /vendor/shop              POST /vendor/shop/documents
GET    /vendor/settings             PUT /vendor/settings
apiResource /vendor/locations
apiResource /vendor/vehicles
POST   /vendor/vehicles/{vehicle}/images       DELETE .../images/{image}
PUT    /vendor/vehicles/{vehicle}/pricing
PUT    /vendor/vehicles/{vehicle}/locations
POST   /vendor/vehicles/{vehicle}/publish · unpublish · archive · submit-for-review
GET    /vendor/vehicles/{vehicle}/availability    PUT (block/unblock date ranges)
GET    /vendor/vehicles/{vehicle}/performance
GET    /vendor/bookings             GET /vendor/bookings/{reference}
POST   /vendor/bookings/{reference}/accept · reject · cancel
POST   /vendor/bookings/{reference}/handover · return · no-show
POST   /vendor/bookings/{reference}/damages
GET    /vendor/calendar
GET    /vendor/finance/earnings · /finance/summary
GET    /vendor/payouts              GET /vendor/payouts/{reference}
GET    /vendor/bank-details         PUT /vendor/bank-details       (owner role only)
apiResource /vendor/expenses · /vendor/expense-categories
GET    /vendor/reviews              POST /vendor/reviews/{review}/reply
GET    /vendor/inquiries            POST /vendor/inquiries/{inquiry}/reply
GET    /vendor/staff   POST /vendor/staff/invite   PUT /vendor/staff/{member}   DELETE /vendor/staff/{member}
GET    /menus/navigation                       existing, now audience-aware
```

### `routes/platform.php` — `platform` guard

```
POST   /platform/login     POST /platform/logout     GET /platform/me
GET    /platform/dashboard · /analytics

GET    /platform/customers · customers/{user}   POST customers/{user}/suspend · activate
GET    /platform/owner-applications · owner-applications/{profile}
POST   /platform/owner-applications/{profile}/approve · reject · request-info · suspend
GET    /platform/shops · shops/{shop}   POST shops/{shop}/verify · reject · suspend · activate · publish
GET    /platform/verifications/{id}/document      signed, audited private download

GET    /platform/listings                       moderation queue
POST   /platform/listings/{vehicle}/approve · reject · unpublish · feature · flag
apiResource /platform/categories

GET    /platform/bookings · bookings/{reference}   POST bookings/{reference}/cancel
GET    /platform/payments · payments/{payment}
GET    /platform/refunds   POST /platform/refunds/{refund}/approve · reject   (finance)
apiResource /platform/commissions                                             (finance)

GET    /platform/payouts   POST /platform/payouts/build                       (finance)
POST   /platform/payouts/{payout}/approve · mark-paid · fail · cancel         (finance)
POST   /platform/payouts/{payout}/evidence                                    (finance)
apiResource /platform/payout-adjustments                                      (finance)
GET    /platform/reconciliation · /reconciliation/export                      (finance)

GET    /platform/disputes · disputes/{ref}   POST disputes/{ref}/assign · resolve · messages
GET    /platform/abuse-reports   POST abuse-reports/{report}/action           (moderator)
GET    /platform/reviews   POST reviews/{review}/publish · reject · hide      (moderator)

GET    /platform/settings   PUT /platform/settings
GET    /platform/audit-logs
# existing and kept: details (branding) · users (system admins) · automations · backups · logs · impersonation
```

### Response-shaping rule

Every endpoint returns an explicit API Resource. Three resource namespaces with three different allow-lists for the same underlying models:

| Namespace | Audience | Example difference on a `Vehicle` |
|---|---|---|
| `Http/Resources/Public/*` | anonymous | no `registration_number`, no `condition_notes`, no shop email |
| `Http/Resources/Vendor/*` | owner / staff of that shop | full record, plus booking history and performance |
| `Http/Resources/Platform/*` | platform admins | full record, plus moderation history and owner identity |

A customer viewing their own booking gets a fourth, narrower shape: full price breakdown and the vehicle's registration number (needed at pickup), but nothing about the shop's commission, payouts or other customers.
