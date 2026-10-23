# Phase 1 — Booking, Payment & Commission Lifecycles

Booking status and payment status are **two independent axes**. Nothing in the booking state machine reads a payment field except the single `confirm` transition, and nothing in the payment state machine writes a booking status except through that one action.

---

## 1. Booking lifecycle

```
                                  ┌──────────────── rejected (terminal)
                                  │                 owner declined
  customer submits                │
  ──────────────▶  PENDING ───────┼──────────────── expired (terminal)
                      │           │                 no owner response by deadline
   owner_response_     │           │                 (expiry_reason = owner_no_response)
   deadline_at set     │           │
                       ▼           │
                   ACCEPTED ───────┴──────────────── expired (terminal)
                      │                              payment window elapsed
   payment_deadline_at set                           (expiry_reason = payment_timeout)
   reservation_hold extended
                      │
          payment verified via webhook
                      ▼
                  CONFIRMED ──────────────────────── cancelled_by_customer
                      │                              cancelled_by_owner
   availability rows written                          cancelled_by_admin
   hold consumed                                     (refund per policy)
                      │
          handover inspection done
                      ▼
                    ACTIVE ──────────────────────── no_show
                      │                              (customer never collected)
          return inspection done
                      ▼
                  COMPLETED (terminal)
                      │
                      ├── deposit release decision
                      ├── review window opens (review_eligible_until)
                      └── becomes payout-eligible after the dispute window
```

### Transition rules

| From | To | Who | Guards |
|---|---|---|---|
| — | `pending` | customer | dates valid, duration within min/max, advance notice met, no blocked dates, vehicle published, shop active, customer licence on file |
| `pending` | `accepted` | owner / staff with `bookings.respond` | **re-validated** overlap + holds under a row lock; before `owner_response_deadline_at` |
| `pending` | `rejected` | owner / staff | reason required |
| `pending` | `expired` | system | `now() > owner_response_deadline_at` |
| `accepted` | `confirmed` | **system only**, from the payment webhook | payment `succeeded`, amount matches `booking_pricing.total_payable` to the cent, overlap re-validated |
| `accepted` | `expired` | system | `now() > payment_deadline_at` and still unpaid |
| `accepted` | `cancelled_by_customer` | customer | free (nothing paid) |
| `confirmed` | `active` | owner / staff with `handover.conduct` | handover inspection saved; not before `pickup_at − grace` |
| `confirmed` | `cancelled_by_*` | customer / owner / admin | refund computed from the frozen cancellation policy |
| `confirmed` | `no_show` | owner / staff | after `pickup_at + no_show_grace_hours` |
| `active` | `completed` | owner / staff with `returns.conduct` | return inspection saved; damages recorded if any |
| any | `cancelled_by_admin` | platform admin | reason + audit row, `severity = critical` |

Every transition is executed by a single `TransitionBooking` action that writes a `booking_status_histories` row, dispatches notifications and emits ledger entries where money is involved. Controllers never set `status` directly.

### Deadlines and holds (all configurable)

| Setting | Source | Default |
|---|---|---|
| owner response window | `shop_settings.owner_response_hours`, falling back to `platform_settings.default_owner_response_hours` | 24 h |
| payment window | `shop_settings.payment_window_hours`, capped at `pickup_at − 2 h` | 12 h |
| reservation hold | matches the current deadline | — |
| no-response policy | `platform_settings.owner_no_response_policy` | `auto_reject` (alternatives: `escalate_to_admin`, `auto_accept` for shops that opted in via `auto_accept_bookings`) |
| no-show grace | `platform_settings.no_show_grace_hours` | 4 h |

### Concurrency — belt and braces

**Deliberate choice: `pending` bookings do not block the calendar.** Several customers may request the same vehicle and dates; the first to be *accepted and paid* wins, and accept-time revalidation rejects the rest. Letting a mere request lock a vehicle would hand anyone a trivial denial-of-availability attack against an owner.

Holds begin at `accepted`. Every path that could create an overlap runs the same guarded block:

```php
DB::transaction(function () use ($vehicleId, $pickupAt, $returnAt, $bookingId) {

    // 1. Serialise all concurrent decisions for THIS vehicle on one row lock.
    $vehicle = Vehicle::whereKey($vehicleId)->lockForUpdate()->firstOrFail();

    // 2. Re-validate against the live database, never against request input.
    $overlap = Booking::where('vehicle_id', $vehicleId)
        ->whereIn('status', ['confirmed', 'active'])
        ->where('pickup_at', '<', $returnAt)
        ->where('return_at', '>', $pickupAt)
        ->whereKeyNot($bookingId)
        ->lockForUpdate()
        ->exists();
    abort_if($overlap, 409, 'Vehicle is no longer available for those dates.');

    $heldElsewhere = ReservationHold::where('vehicle_id', $vehicleId)
        ->where('status', 'active')
        ->where('expires_at', '>', now())
        ->where('start_date', '<', $returnAt)
        ->where('end_date', '>', $pickupAt)
        ->where('booking_id', '!=', $bookingId)
        ->exists();
    abort_if($heldElsewhere, 409, 'Vehicle is on hold for another request.');

    abort_if($this->hasBlockedDates($vehicleId, $pickupAt, $returnAt), 409, 'Dates unavailable.');

    // 3. On confirm: one availability row per rental day.
    //    unique(vehicle_id, date) is the hard backstop — a racing transaction
    //    that slipped past the checks dies here on a duplicate key and rolls back.
    VehicleAvailability::insert($this->dayRows($vehicleId, $pickupAt, $returnAt, $bookingId));
});
```

The overlap predicate `pickup_at < :return_at AND return_at > :pickup_at` is the standard half-open interval test: back-to-back rentals (one returns 10:00, next collects 10:00) do **not** collide.

Why both the lock and the unique index: the row lock makes concurrent decisions serialise cleanly and produce a friendly 409. The unique index means that even if someone later adds a new confirmation path and forgets the lock, the database still refuses the double booking. Correctness does not depend on every future developer remembering.

### Scheduled sweeps

These register in the existing `automations` table so the platform admin can see and toggle them.

| Job | Cadence | Does |
|---|---|---|
| `bookings:expire-unanswered` | 5 min | `pending` past the response deadline → apply the no-response policy |
| `bookings:expire-unpaid` | 5 min | `accepted` + unpaid past the payment deadline → `expired`, release hold |
| `holds:release-expired` | 5 min | `active` holds past `expires_at` → `expired` |
| `bookings:flag-overdue` | hourly | `active` past `return_at` → late-fee accrual + notify both sides |
| `payments:reconcile` | hourly | query the gateway for payments stuck `initiated`/`pending`; settle locally (catches lost webhooks) |
| `payouts:build-cycle` | daily | build `draft` payouts per shop payout schedule |
| `reviews:close-window` | daily | expire review eligibility |

---

## 2. Payment lifecycle

```
accepted booking
      │  POST /bookings/{ref}/checkout
      ▼
  payments row: status = initiated, idempotency_key set
  amount read from booking_pricing.total_payable  (NEVER from the request)
  PayHere payload + md5 hash computed SERVER-SIDE
      │
      ▼
  customer pays on the gateway's hosted page
      │
      ├──▶ browser return_url  ──▶  treated as UX ONLY, never as proof of payment
      │                             (page polls GET /bookings/{ref} for real state)
      │
      └──▶ PayHere server-to-server notify
                 │
                 ▼
         POST /webhooks/payhere      (public, CSRF-exempt, unauthenticated)
                 │
                 │ 1. INSERT payment_webhook_events  ── unique(gateway, event_id)
                 │       duplicate key ──▶ 200 OK, do nothing            ◀── idempotency
                 │ 2. verify md5sig against the merchant secret
                 │       invalid ──▶ status=ignored, 200, alert admin
                 │ 3. SELECT ... FOR UPDATE the payment by order_id
                 │ 4. assert amount == booking_pricing.total_payable AND currency == LKR
                 │       mismatch ──▶ payment=failed, flag for admin, do NOT confirm
                 │ 5. status_code 2  ──▶ payment=succeeded
                 │                       ConfirmBookingAction (same transaction)
                 │    status_code 0  ──▶ pending       (no booking change)
                 │    status_code -1 ──▶ cancelled
                 │    status_code -2 ──▶ failed
                 │    status_code -3 ──▶ chargeback    (open dispute, hold payout)
                 │ 6. write ledger_entries, mark event processed, notify
                 ▼
             200 OK  (always 200 on a handled event — never leak detail)
```

`booking.payment_status`: `unpaid` → `initiated` → `authorized` / `paid` → `refund_pending` → `partially_refunded` / `refunded`; or `failed`. Independent of booking status throughout.

### Rules that make this safe

1. **Amount is never accepted from the client.** The checkout endpoint takes only a booking reference. The amount comes from `booking_pricing.total_payable`, and the PayHere hash is computed from it with the merchant secret, so a tampered amount fails verification at the gateway before it ever reaches us.
2. **The browser redirect proves nothing.** Confirmation happens only in the webhook (or in reconciliation). A user who closes the tab still gets confirmed; a user who crafts a fake return URL does not.
3. **Idempotency is a database constraint, not application logic.** `unique(gateway, event_id)` plus a unique `idempotency_key` on `payments`. PayHere retries notifications; retries are free.
4. **Amount and currency are re-asserted** inside the locked transaction. A mismatch never confirms a booking.
5. **Card data never touches our servers.** Gateway-hosted checkout; we store brand + last4 only.
6. **Reconciliation closes the gap.** Lost webhooks are caught hourly by querying the gateway for any non-terminal payment.

### Refunds

Requested by the customer (cancellation) or the system (deposit return), **approved by a platform `finance` admin**, then executed through the gateway where possible or recorded as a manual bank transfer. A refund reaches `completed` only with `gateway_refund_id` or `evidence_reference` present. Every refund writes ledger entries and reduces `booking_financials.refunded_amount`.

### Security deposit

Flagged separately from the first line of code because conflating it with revenue is the most common accounting error in rental marketplaces.

- `hold_method = prepaid` → collected with the rental payment, sits in `deposit_liability`, refunded after the return inspection minus agreed deductions.
- `hold_method = cash_on_pickup` → collected by the shop at handover, recorded but never routed through the platform.
- `hold_method = waived`.

The deposit is **never** part of the commission base, **never** counted as rental revenue, and **never** included in the owner payable until the return inspection has decided it.

---

## 3. Commission model

### Rule resolution — most specific wins

```
1. vehicle-scoped rule   (scope_type = vehicle,  scope_id = vehicle_id)
2. shop-scoped rule      (scope_type = shop,     scope_id = shop_id)
3. category-scoped rule  (scope_type = category, scope_id = category_id)
4. global rule           (scope_type = global)
```

Within a tier: highest `priority`, then latest `effective_from`. The rule must be `is_active` and inside its effective window **at the moment the booking is confirmed** — then its id, rate and computed amount are **frozen into `booking_financials`**. Changing or deleting a rule tomorrow never re-prices a booking that already exists.

### Calculation

```
commissionable = base_amount
               + (applies_to = rental_plus_extras
                     ? extras_amount + delivery_amount + driver_amount
                     : 0)
                                            ← security_deposit is NEVER included
                                            ← tax collected on behalf of the state is NEVER included

commission     = round(commissionable × percentage / 100, 2) + fixed_amount
commission     = clamp(commission, min_amount, max_amount)

processing_fee = gateway fee actually charged on the settled payment

owner_payable  = commissionable_collected
               − commission
               − (processing_fee_borne_by = owner  ? processing_fee : 0)
               − (processing_fee_borne_by = split  ? processing_fee / 2 : 0)
               − withholding_tax
               + credit adjustments
               − debit adjustments
```

Worked example (LKR):

| Line | Amount |
|---|---|
| Base rental, 5 days × 8,500 | 42,500.00 |
| Driver, 5 days × 3,500 | 17,500.00 |
| Delivery | 2,000.00 |
| Subtotal (commissionable, `rental_plus_extras`) | **62,000.00** |
| Security deposit (liability, not revenue) | 15,000.00 |
| **Customer pays** | **77,000.00** |
| Platform commission @ 12% | −7,440.00 |
| Gateway fee @ 3.30% of 77,000, borne by platform | −2,541.00 |
| **Owner payable** | **54,560.00** |
| **Platform net** | **4,899.00** |
| Deposit held as liability, returned after inspection | 15,000.00 |

### Ledger entries at confirmation

```
DEBIT   platform_cash          77,000.00     cash actually received
CREDIT  customer_receivable    62,000.00     rental revenue recognised
CREDIT  deposit_liability      15,000.00     NOT revenue
DEBIT   gateway_fees            2,541.00
CREDIT  platform_cash           2,541.00
CREDIT  commission_income       7,440.00
DEBIT   customer_receivable     7,440.00
CREDIT  owner_payable          54,560.00     accrues, but not yet payable
DEBIT   customer_receivable    54,560.00
```

`owner_payable` accrues at confirmation but becomes **payout-eligible** only once the booking is `completed` and past `payout_dispute_window_days`. So a confirmed-but-not-yet-driven rental never gets paid out, and an unpaid booking never appears as collected revenue anywhere.

### Payout cycle — manual settlement

PayHere does not support marketplace splits or sub-merchant payouts, so platform-collects-then-settles is not a shortcut, it is the only available design. (See `06-plan-and-risks.md` — this must still be confirmed against the live merchant account before Phase 5.)

```
   payouts:build-cycle (per shop payout_schedule)
         │  selects booking_financials where
         │    settlement_status = unsettled
         │    AND booking.status = completed
         │    AND now() > eligible_for_payout_at
         │    AND NOT booking.has_open_dispute
         │  applies pending payout_adjustments
         │  skips the shop if net_amount < min_payout_threshold (carries forward)
         ▼
      DRAFT ──▶ PENDING_APPROVAL ──▶ APPROVED ──▶ PROCESSING ──▶ PAID
                   finance admin       finance      bank transfer     ▲
                                                    executed offline  │
                                                                      │
                            requires evidence_attachment_id ───────────┘
                            OR evidence_reference (bank txn no.)
                                          │
                                       FAILED ──▶ items released back to the pool
```

Guardrails:

- The state machine **refuses** `paid` without settlement evidence. Required: *"Never mark a payout complete until verified evidence of settlement is recorded."*
- `unique(payout_id, booking_id)` plus a service check that a booking is in at most one non-cancelled payout — a booking can never be paid twice.
- Optional two-person rule: `approved_by != paid_by`.
- `paid` writes `DEBIT owner_payable / CREDIT platform_cash` to the ledger and flips the items' `settlement_status` to `paid`.
- A negative net (clawbacks exceeding earnings) carries forward as a `carry_forward` adjustment rather than producing a negative transfer.
- Every status change writes an `audit_logs` row at `severity = critical`.
