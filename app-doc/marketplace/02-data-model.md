# Phase 1 — Marketplace Data Model

~45 tables. `shop_id` columns carry `BelongsToShop` (automatic `ShopScope`) unless noted. Money is `decimal(14,2)`, currency is `char(3)` fixed to `LKR`. Every table has `timestamps`; soft deletes only where a record must survive for audit.

Legend: **PII** = encrypted at rest + access-restricted · **PUB** = reachable by anonymous visitors.

---

## 1. Identity & verification

### `users` *(existing — trimmed)*
Drop `company_id`, `employee_id`, `gender`, `joining_date`, `emergency_contact` (HR fields from the old app).
Keep `name`, `email`, `password`, `phone`, `avatar`, `address`, `date_of_birth`, `is_active`, soft deletes.
Add: `email_verified_at`, `phone_verified_at`, `phone_country` (default `LK`), `status` enum(`active`,`suspended`,`banned`), `suspended_reason`, `suspended_at`, `last_login_at`, `registration_source`.

No role column — roles are spatie rows, and a user holds several at once.

### `customer_profiles`
`user_id` unique → users · `nic_number` **PII** · `driving_licence_no` **PII** · `licence_country` · `licence_issued_on` · `licence_expiry` · `licence_classes` json · `address_line_1/2` · `city` · `district` · `postal_code` · `emergency_contact_name` · `emergency_contact_phone` · `verification_status` enum(`unverified`,`pending`,`verified`,`rejected`) · `verified_at` · `verified_by` → system_admins

Renting a vehicle legally requires a licence, so this is not optional decoration. A shop sees licence **validity flags** on a booking it owns, not the raw number.

### `shop_verifications`
`shop_id` → rental_shops · `document_type` enum(`business_registration`,`tax_identification`,`bank_statement`,`insurance_policy`,`trade_licence`,`lease_agreement`,`other`) · `attachment_id` → attachments (private disk) · `status` enum(`pending`,`verified`,`rejected`) · `reviewed_by` → system_admins · `reviewed_at` · `rejection_reason` · `expires_at`

This is the only vendor KYC — there is no individual-owner flow (see 01-phase1-architecture.md §3.1).

---

## 2. Vendor (shop) tables

### `rental_shops` *(was `companies`)*
`owner_user_id` → users (the creator) · `name` · `slug` unique **PUB** · `description` **PUB** · `tagline` **PUB** ·
contact: `email` · `phone` **PUB** · `whatsapp` **PUB** · `website` ·
location: `address_line_1/2` **PUB** · `city` **PUB** · `district` **PUB** · `postal_code` · `latitude` **PUB** · `longitude` **PUB** ·
`operating_hours` json **PUB** (`{mon:{open:"08:30",close:"18:00",closed:false}, …}`) ·
`pickup_instructions` **PUB** · `return_instructions` **PUB** · `rental_terms` **PUB** · `cancellation_policy` **PUB** ·
media: `logo` **PUB** · `cover_image` **PUB** ·
business: `business_registration_no` · `tax_id` **PII** ·
state: `status` enum(`draft`,`pending_review`,`active`,`suspended`,`rejected`) · `verification_status` enum(`unverified`,`pending`,`verified`,`rejected`) · `verified_at` · `verified_by` · `is_published` bool · `published_at` · `suspended_reason` ·
commerce: `commission_rate_override` nullable · `payout_schedule` enum(`weekly`,`biweekly`,`monthly`,`manual`) · `min_payout_threshold` ·
reputation: `rating_avg` decimal(3,2) **PUB** · `rating_count` **PUB** · `completed_bookings_count` **PUB** · `response_rate` **PUB** · `avg_response_minutes` **PUB** ·
soft deletes

Columns dropped from `companies`: `emirate`, `trn`, `legal_name` → replaced by the above; `currency`/`timezone` fixed to `LKR` / `Asia/Colombo` at config level.

### `shop_members`
`shop_id` → rental_shops · `user_id` → users · `role` enum(`owner`,`manager`,`staff`) · `abilities` json · `status` enum(`invited`,`active`,`suspended`,`revoked`) · `invited_by` → users · `invite_token` · `invite_expires_at` · `invited_at` · `accepted_at` · `revoked_at`
**unique(`shop_id`,`user_id`)** · index(`user_id`,`status`) — this index is hit on every single vendor request by `ResolveShopContext`.

### `shop_settings` *(was `company_settings`)*
`shop_id` unique · `booking_prefix` default `BKG` · `next_booking_number` · `payout_prefix` default `PO` · `next_payout_number` · `agreement_prefix` ·
`owner_response_hours` default 24 · `payment_window_hours` default 12 · `auto_accept_bookings` bool default false · `advance_notice_hours` default 4 ·
`default_min_rental_days` default 1 · `default_max_rental_days` · `free_cancellation_hours` default 48 · `cancellation_tiers` json ·
`agreement_terms` text · `invoice_footer` text

All quotation/invoice numbering from the old app is dropped.

### `owner_bank_details`
`shop_id` → rental_shops · `account_holder_name` · `bank_name` · `bank_code` · `branch_name` · `branch_code` · `account_number` **PII (encrypted)** · `account_number_last4` (plain, for display) · `account_type` · `is_primary` bool · `verification_status` enum(`unverified`,`pending`,`verified`,`rejected`) · `verified_by` → system_admins · `verified_at` · soft deletes

Access: shop `owner` role only (never `manager`/`staff`), plus the platform `finance` admin role. Excluded from every list endpoint; the full number is returned by **no** endpoint — only `account_number_last4`. The payout screen shows `•••• 4821`.

---

## 3. Vehicles & listings

### `vehicle_categories` **PUB**
`parent_id` self-nullable · `name` · `slug` unique · `icon` · `description` · `image` · `sort_order` · `is_active` · `commission_rate` nullable (feeds the category-scoped commission rule) · `default_min_rental_days`
Seeded: Car, SUV, Van, Minibus, Bus, Cab/Tuk-tuk, Motorcycle, Scooter, Pickup/Lorry, Luxury, Wedding Car, Self-Drive. Configurable by admin.

### `vehicles`
`shop_id` → rental_shops cascade · `category_id` → vehicle_categories · `created_by` → users ·
identity: `title` **PUB** · `slug` unique **PUB** · `make` **PUB** · `model` **PUB** · `year` **PUB** · `variant` **PUB** · `colour` **PUB** · `registration_number` **(private — owner/staff/admin and the confirmed renter only)** ·
specs: `transmission` enum(`manual`,`automatic`,`semi_automatic`,`cvt`) **PUB** · `fuel_type` enum(`petrol`,`diesel`,`hybrid`,`electric`,`lpg`) **PUB** · `engine_capacity_cc` **PUB** · `seating_capacity` **PUB** · `luggage_capacity` **PUB** · `doors` **PUB** · `air_conditioned` bool **PUB** · `features` json **PUB** · `description` **PUB** · `condition_notes` ·
state: `status` enum(`draft`,`pending_review`,`published`,`unpublished`,`archived`,`rejected`) · `moderation_status` enum(`pending`,`approved`,`rejected`,`flagged`) · `moderation_note` · `published_at` · `archived_at` ·
promotion: `is_featured` bool · `featured_until` ·
metrics: `rating_avg` **PUB** · `rating_count` **PUB** · `view_count` · `inquiry_count` · `booking_count` **PUB** · `last_booked_at` ·
soft deletes

Indexes: `(shop_id, status)`, `(category_id, status, moderation_status)`, `(status, moderation_status, published_at)` for the public feed, `(is_featured, featured_until)`, unique(`slug`).

A vehicle becomes publicly visible only when **all** hold: `status = published` AND `moderation_status = approved` AND its shop is `active` + `is_published`. If the shop's `verification_status != verified`, publication additionally requires the platform setting `allow_unapproved_owner_publishing = true` (default **false**, per the requirement).

### `vehicle_images` **PUB**
`vehicle_id` cascade · `attachment_id` → attachments · `sort_order` · `is_primary` bool · `alt_text`
Partial-unique intent: exactly one `is_primary` per vehicle (enforced in the service; MySQL has no partial unique index).

### `vehicle_pricing`
`vehicle_id` unique cascade · `currency` LKR ·
rates **PUB**: `daily_rate` · `weekly_rate` nullable · `monthly_rate` nullable · `weekend_surcharge_pct` ·
deposit **PUB**: `security_deposit` · `deposit_method` enum(`prepaid`,`cash_on_pickup`,`waived`) ·
mileage **PUB**: `mileage_allowance_per_day_km` nullable (null = unlimited) · `excess_mileage_rate_per_km` ·
extras **PUB**: `driver_rate_per_day` nullable · `delivery_available` bool · `delivery_free_radius_km` · `delivery_fee_per_km` · `delivery_flat_fee` · `cleaning_fee` · `late_return_fee_per_hour` · `fuel_policy` enum(`full_to_full`,`prepaid`,`same_level`) ·
rules **PUB**: `min_rental_days` default 1 · `max_rental_days` nullable · `advance_notice_hours` ·
`tax_rate` (VAT/SSCL where applicable) · `updated_by` · `updated_at`

Separate table because pricing is rewritten far more often than vehicle specs, and because `booking_pricing` snapshots this row wholesale.

### `vehicle_pickup_locations`
`vehicle_id` cascade · `location_id` → locations · `is_default` bool · `delivery_allowed` bool
**unique(`vehicle_id`,`location_id`)**

### `vehicle_availability`
`vehicle_id` cascade · `date` date · `status` enum(`available`,`blocked`,`booked`,`maintenance`) · `booking_id` nullable → bookings · `note` · `created_by`
**unique(`vehicle_id`,`date`)** ← **this unique index is the hard database-level backstop against double booking.** See the concurrency section in `03-lifecycles.md`.
Index `(vehicle_id, date, status)` for calendar reads.

### `reservation_holds`
`vehicle_id` cascade · `booking_id` nullable → bookings · `user_id` → users · `start_date` · `end_date` · `expires_at` · `status` enum(`active`,`consumed`,`released`,`expired`) · `reason`
Index `(vehicle_id, status, start_date, end_date)` · index `(status, expires_at)` for the sweeper.

### `listing_moderation_history`
`vehicle_id` cascade · `from_status` · `to_status` · `action` enum(`submitted`,`approved`,`rejected`,`unpublished`,`republished`,`archived`,`flagged`,`featured`,`unfeatured`) · `actor_type` enum(`owner`,`staff`,`system_admin`,`system`) · `actor_id` · `reason` · `notes` · `created_at`
Append-only.

---

## 4. Bookings

### `bookings`
`booking_reference` unique (`BKG-2026-00001`, from `NumberGenerator`) ·
`vehicle_id` → vehicles restrictOnDelete · `shop_id` → rental_shops · `customer_id` → users ·
pickup/return: `pickup_location_id` nullable → locations · `pickup_address` · `pickup_latitude` · `pickup_longitude` · `return_location_id` nullable · `return_address` · `delivery_requested` bool · `delivery_distance_km` ·
timing: `pickup_at` datetime · `return_at` datetime · `rental_days` unsigned · `actual_pickup_at` · `actual_return_at` ·
options: `with_driver` bool · `driver_days` ·
**`status`** enum(`pending`,`accepted`,`confirmed`,`active`,`completed`,`rejected`,`expired`,`cancelled_by_customer`,`cancelled_by_owner`,`cancelled_by_admin`,`no_show`) ·
**`payment_status`** enum(`unpaid`,`initiated`,`authorized`,`partially_paid`,`paid`,`refund_pending`,`partially_refunded`,`refunded`,`failed`) ·
deadlines: `owner_response_deadline_at` · `payment_deadline_at` ·
decisions: `accepted_at` · `decided_by` → users · `rejected_at` · `rejection_reason` · `confirmed_at` · `cancelled_at` · `cancelled_by_type` enum(`customer`,`owner`,`staff`,`system_admin`,`system`) · `cancelled_by_id` · `cancellation_reason` · `completed_at` · `expired_at` · `expiry_reason` enum(`owner_no_response`,`payment_timeout`,`hold_lost`) ·
notes: `customer_note` · `owner_note` · `internal_note` (admin-only) ·
flags: `has_open_dispute` bool · `review_eligible_until` ·
soft deletes

Indexes: unique(`booking_reference`) · `(shop_id, status)` · `(customer_id, status)` · **`(vehicle_id, status, pickup_at, return_at)`** ← the overlap check · `(status, owner_response_deadline_at)` and `(status, payment_deadline_at)` for the sweepers.

Status and payment_status are **two independent axes**, as required. "Awaiting payment" is not a status — it is the derived state `status = accepted AND payment_status IN (unpaid, initiated, failed)`.

### `booking_pricing` — immutable quote snapshot
`booking_id` unique cascade · `currency` · `pricing_snapshot` json (verbatim copy of `vehicle_pricing` at request time) ·
`rate_plan` enum(`daily`,`weekly`,`monthly`,`mixed`) · `rate_breakdown` json (e.g. `[{plan:"monthly",units:1,rate:120000},{plan:"daily",units:3,rate:5500}]`) ·
`base_amount` · `extras_amount` · `delivery_amount` · `driver_amount` · `weekend_surcharge_amount` ·
`discount_code` · `discount_amount` ·
`subtotal` · `tax_rate` · `tax_amount` · `service_fee` ·
`security_deposit` · `total_payable` ·
`mileage_allowance_total_km` · `excess_mileage_rate_per_km` ·
`computed_at` · `computed_by` enum(`system`) · `snapshot_hash` (sha256 of the inputs — proves it was not edited)

No update path exists. A re-quote creates a new booking.

### `booking_financials` — settlement view
`booking_id` unique cascade · `currency` ·
collected: `customer_paid_amount` · `security_deposit_held` ·
revenue split: `gross_rental_amount` · `commissionable_amount` · `commission_rule_id` → platform_commissions · `commission_rate` · `commission_fixed` · `commission_amount` · `payment_processing_fee` · `processing_fee_borne_by` enum(`platform`,`owner`) · `tax_withheld` ·
`owner_payable_amount` · `platform_net_amount` ·
reversals: `refunded_amount` · `deposit_returned_amount` · `deposit_forfeited_amount` · `damage_charged_amount` · `adjustments_amount` ·
settlement: `settlement_status` enum(`not_eligible`,`unsettled`,`in_payout`,`partially_paid`,`paid`,`on_hold`) · `payout_id` nullable → owner_payouts · `eligible_for_payout_at`
Index `(shop_id via booking, settlement_status)` through a covering query; `(settlement_status, eligible_for_payout_at)`.

### `booking_extras`
`booking_id` cascade · `type` enum(`driver`,`child_seat`,`gps`,`additional_driver`,`insurance`,`delivery`,`pickup`,`other`) · `name` · `unit_price` · `quantity` · `amount` · `is_taxable` bool

### `booking_status_histories`
`booking_id` cascade · `field` enum(`status`,`payment_status`) · `from_value` · `to_value` · `actor_type` · `actor_id` · `reason` · `meta` json · `created_at`
Append-only. Required: *"Record booking and payout status changes."*

### `booking_inspections`
`booking_id` cascade · `type` enum(`handover`,`return`) · `odometer_reading` · `fuel_level` enum(`empty`,`quarter`,`half`,`three_quarter`,`full`) · `exterior_checklist` json · `interior_checklist` json · `accessories_checklist` json · `notes` · `customer_present` bool · `customer_signature_path` · `conducted_by` → users · `conducted_at`
Photos attach polymorphically via `attachments`.
**unique(`booking_id`,`type`)** — exactly one handover and one return.

### `booking_damages`
`booking_id` cascade · `inspection_id` nullable → booking_inspections · `area` · `description` · `severity` enum(`minor`,`moderate`,`major`) · `estimated_cost` · `charged_amount` · `status` enum(`reported`,`under_review`,`charged`,`waived`,`disputed`,`resolved`) · `reported_by` → users · `resolved_by` · `resolved_at` · `resolution_note`

---

## 5. Payments, commission, payouts, ledger

### `payments`
`booking_id` → bookings · `payment_reference` unique (used as the gateway `order_id`) ·
`gateway` enum(`payhere`,`bank_transfer`,`cash`,`manual`) · `gateway_order_id` · `gateway_payment_id` · `gateway_status_code` ·
`type` enum(`rental`,`security_deposit`,`extra`,`damage`,`late_fee`,`balance`) ·
`amount` · `currency` · `gateway_fee` ·
`status` enum(`initiated`,`pending`,`authorized`,`succeeded`,`failed`,`cancelled`,`expired`,`chargeback`) ·
`method` enum(`visa`,`mastercard`,`amex`,`ezcash`,`mcash`,`genie`,`bank`,`cash`,`other`) · `method_detail` json (brand + last4 only — **no PAN, no CVV, ever**) ·
`paid_at` · `failed_at` · `failure_reason` ·
`idempotency_key` unique · `initiated_by` → users · `raw_response` json (trimmed) · soft deletes

Indexes: unique(`payment_reference`), unique(`idempotency_key`), `(booking_id, status)`, `(status, created_at)` for the reconciliation sweep.

### `payment_webhook_events` — the idempotency guard
`gateway` · `event_id` · `event_type` · `signature_valid` bool · `payload` json · `received_at` ·
`status` enum(`received`,`processed`,`ignored`,`duplicate`,`failed`) · `processed_at` · `attempts` · `error` · `payment_id` nullable → payments · `ip`
**unique(`gateway`,`event_id`)** ← inserting this row **is** the duplicate check. A repeated webhook hits the unique key, the handler returns 200 and does nothing. No webhook is ever processed twice.

### `refunds`
`booking_id` · `payment_id` nullable → payments · `refund_reference` unique ·
`amount` · `currency` · `type` enum(`cancellation`,`deposit_return`,`overcharge`,`damage_waiver`,`goodwill`,`chargeback`,`no_show_partial`) · `reason` ·
`status` enum(`requested`,`approved`,`processing`,`completed`,`rejected`,`failed`) ·
`method` enum(`gateway`,`bank_transfer`,`cash`,`credit_note`) ·
`requested_by` → users · `approved_by` → system_admins · `approved_at` · `gateway_refund_id` · `processed_at` ·
`evidence_attachment_id` · `evidence_reference` · `notes`

### `security_deposits`
`booking_id` unique · `amount_required` · `amount_collected` · `hold_method` enum(`prepaid`,`cash_on_pickup`,`waived`) ·
`status` enum(`pending`,`held`,`partially_released`,`released`,`forfeited`) ·
`collected_at` · `released_at` · `deductions_amount` · `deduction_reason` · `release_refund_id` nullable → refunds · `decided_by`

The deposit is a **liability**, never revenue, and never part of the commission base or the owner payable until the return inspection decides it.

### `platform_commissions` — commission *rules*
`name` · `scope_type` enum(`global`,`category`,`shop`,`vehicle`) · `scope_id` nullable ·
`percentage` decimal(5,2) · `fixed_amount` · `min_amount` nullable · `max_amount` nullable ·
`applies_to` enum(`rental_only`,`rental_plus_extras`) ·
`processing_fee_borne_by` enum(`platform`,`owner`,`split`) ·
`priority` int · `effective_from` · `effective_to` nullable · `is_active` bool · `notes` · `created_by` → system_admins
Index `(scope_type, scope_id, is_active, effective_from)`.

### `owner_payouts`
`payout_reference` unique (`PO-2026-00042`) · `shop_id` → rental_shops ·
`period_start` · `period_end` · `currency` ·
`gross_rental_amount` · `commission_amount` · `processing_fee_amount` · `tax_withheld_amount` · `adjustments_amount` · `net_amount` · `booking_count` ·
`status` enum(`draft`,`pending_approval`,`approved`,`processing`,`paid`,`failed`,`cancelled`) ·
`payout_method` enum(`bank_transfer`,`cheque`,`cash`,`manual`) · `bank_detail_id` → owner_bank_details ·
`scheduled_for` · `approved_by` → system_admins · `approved_at` · `paid_by` → system_admins · `paid_at` ·
**`evidence_attachment_id`** · **`evidence_reference`** (bank transaction number) · `evidence_recorded_at` ·
`failure_reason` · `notes` · soft deletes

**Invariant:** the state machine refuses the transition to `paid` unless `evidence_attachment_id` **or** `evidence_reference` is present. Required: *"Never mark a payout complete until verified evidence of settlement is recorded."* Optional two-person rule: `approved_by != paid_by`.

### `owner_payout_items`
`payout_id` cascade · `booking_id` → bookings · `financial_snapshot` json · `gross_amount` · `commission_amount` · `processing_fee_amount` · `net_amount`
**unique(`payout_id`,`booking_id`)** plus a service-level guarantee that a booking appears in at most one non-cancelled payout — so no booking is ever paid out twice.

### `payout_adjustments`
`shop_id` → rental_shops · `payout_id` nullable → owner_payouts · `booking_id` nullable ·
`type` enum(`damage_recovery`,`refund_clawback`,`penalty`,`bonus`,`correction`,`carry_forward`,`manual`) ·
`direction` enum(`credit`,`debit`) · `amount` · `reason` ·
`status` enum(`pending`,`applied`,`cancelled`) · `created_by` → system_admins · `approved_by` · `applied_at`

Un-applied adjustments are picked up by the next payout cycle; a negative balance carries forward rather than producing a negative transfer.

### `ledger_entries` — append-only financial ledger
`entry_date` · `account` enum(`customer_receivable`,`platform_cash`,`gateway_fees`,`commission_income`,`owner_payable`,`deposit_liability`,`refunds_payable`,`tax_payable`,`damage_recovery`,`adjustments`) ·
`direction` enum(`debit`,`credit`) · `amount` · `currency` ·
`booking_id` nullable · `shop_id` nullable · `payout_id` nullable · `payment_id` nullable · `refund_id` nullable ·
`source_type` · `source_id` · `memo` · `batch_id` · `created_at`

No `updated_at`, no soft delete, no update or delete route — corrections are new reversing entries. Index `(account, entry_date)`, `(booking_id)`, `(shop_id, account)`.

---

## 6. Marketplace & social

### `reviews`
`booking_id` unique → bookings · `vehicle_id` · `shop_id` · `user_id` → users ·
`rating` tinyint 1–5 · `rating_cleanliness` · `rating_condition` · `rating_value` · `rating_communication` · `rating_accuracy` ·
`title` · `comment` ·
`status` enum(`pending`,`published`,`rejected`,`hidden`) · `moderated_by` → system_admins · `moderated_at` · `moderation_reason` ·
`owner_reply` · `owner_replied_at` · `owner_replied_by` ·
`helpful_count` · `is_verified_booking` bool default true

**unique(`booking_id`)** — one review per booking, and a booking only becomes reviewable at `status = completed` within `review_eligible_until`. That makes every published review provably tied to a real completed rental.

### `favorites`
`user_id` → users cascade · `vehicle_id` → vehicles cascade · `created_at`
**unique(`user_id`,`vehicle_id`)**

### `vehicle_inquiries`
`vehicle_id` · `shop_id` · `user_id` nullable · `name` · `phone` · `email` · `message` · `status` enum(`new`,`read`,`replied`,`closed`,`spam`) · `replied_at` · `replied_by` · `reply_message` · `ip`
Rate-limited; only created when the shop has inquiries enabled.

### `disputes`
`dispute_reference` unique · `booking_id` → bookings · `raised_by_user_id` → users · `raised_by_side` enum(`customer`,`owner`,`staff`) · `against_side` enum(`customer`,`owner`,`platform`) ·
`category` enum(`damage`,`no_show`,`overcharge`,`vehicle_condition`,`refund`,`late_return`,`fraud`,`other`) ·
`subject` · `description` · `claimed_amount` ·
`status` enum(`open`,`under_review`,`awaiting_info`,`resolved`,`closed`,`escalated`) · `priority` enum(`low`,`normal`,`high`,`urgent`) ·
`assigned_to` → system_admins · `resolution` · `resolution_amount` · `resolution_in_favour_of` enum(`customer`,`owner`,`split`,`none`) · `resolved_by` · `resolved_at` · `closed_at`

An open dispute sets `bookings.has_open_dispute` and puts `booking_financials.settlement_status = on_hold` — the payout builder skips it.

### `dispute_messages`
`dispute_id` cascade · `author_type` enum(`customer`,`owner`,`staff`,`system_admin`,`system`) · `author_id` · `message` · `is_internal` bool · `attachment_id` nullable · `created_at`
`is_internal = true` messages are visible to platform admins only.

### `reports` — abuse / fraud reporting
`reportable_type` + `reportable_id` (vehicle, review, user, shop, booking) · `reported_by_user_id` nullable · `reporter_email` ·
`reason` enum(`fraud`,`fake_listing`,`duplicate_listing`,`inappropriate_content`,`spam`,`unsafe_vehicle`,`misleading_price`,`harassment`,`other`) · `description` ·
`status` enum(`new`,`reviewing`,`actioned`,`dismissed`) · `reviewed_by` → system_admins · `reviewed_at` · `action_taken` · `internal_note`
Index `(reportable_type, reportable_id)`, `(status, created_at)`.

---

## 7. Platform, notifications, infrastructure

### `notifications` *(Laravel standard)*
uuid · `type` · `notifiable_type` + `notifiable_id` (polymorphic — works for both `users` and `system_admins`) · `data` json · `read_at`

### `notification_preferences`
`user_id` → users · `event` (e.g. `booking.requested`, `booking.accepted`, `payout.paid`) · `channel` enum(`database`,`mail`,`sms`,`whatsapp`) · `enabled` bool
**unique(`user_id`,`event`,`channel`)**

### `platform_settings`
`key` unique · `value` json · `group` · `label` · `description` · `type` · `is_public` bool · `updated_by`
Seeded keys include: `allow_unapproved_owner_publishing` (**false**), `default_owner_response_hours` (24), `default_payment_window_hours` (12), `reservation_hold_minutes`, `owner_no_response_policy` (`auto_reject` | `escalate_to_admin` | `auto_accept`), `payout_dispute_window_days` (3), `min_payout_threshold` (LKR 5,000), `default_commission_percentage` (12.00), `vat_rate`, `review_window_days` (14), `featured_listing_limit`, `maintenance_mode`.

### `system_admins` *(existing — extended)*
Add `admin_role` enum(`platform_owner`,`admin`,`finance`,`moderator`,`support`) · `is_active` · `last_login_at`.
This splits platform duties: only `finance` approves payouts and refunds; only `moderator` acts on listings and reviews; `support` handles disputes; `platform_owner` manages admins and destructive operations. Required by *"Record sensitive administrative actions in an audit trail"* having any meaning.

### `audit_logs` *(existing — extended)*
Add `shop_id` nullable · `before` json · `after` json · `severity` enum(`info`,`notice`,`warning`,`critical`) · `context` json · `user_agent`.
Keeps existing `user_id`, `system_admin_id`, `action`, `form`, `record_id`, `record`, `ip`, `browser`.

### `attachments` *(existing — extended)*
Add `visibility` enum(`public`,`private`,`restricted`) default `private` · `disk` · `checksum` · `document_category`.
`public` → vehicle images, shop logos (public disk, CDN-cacheable).
`private` → KYC, bank proof, payout evidence (private disk; served only through a signed, short-lived, permission-checked download route; every access audited).

### `expenses` *(existing — repurposed)*
Add `vehicle_id` nullable → vehicles · `expense_type` enum(`fuel`,`service`,`repair`,`insurance`,`revenue_licence`,`emission_test`,`tyres`,`cleaning`,`parking`,`fine`,`other`) · `odometer_reading`.
`company_id` → `shop_id`. Categories seeded for Sri Lankan vehicle running costs.

### `locations` *(existing — kept)*
`company_id` → `shop_id`. Already carries address, lat/lng and branch details. Gains `type` enum(`branch`,`pickup_point`,`airport`,`hotel`,`custom`) and `is_active`.

---

## 8. Tables deleted from the old schema

`customers`, `items`, `item_daily_prices`, `units`, `vendors`, `purchases`, `purchase_items`, `purchase_payments`, `sales`, `sale_items`, `sale_payments`, `plans`, `subscriptions`

`companies` → renamed `rental_shops`; `company_settings` → renamed `shop_settings`; every `company_id` FK → `shop_id`.
