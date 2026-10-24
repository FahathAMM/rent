# Phase 8 — Production Deployment Checklist

Everything below is a real gap found by reading the current config and
console commands, not a generic template. Each item names the exact file
or command involved.

## 1. Environment (`backend/.env`)

| Variable | Dev default | Production value |
|---|---|---|
| `APP_ENV` | `local` | `production` |
| `APP_DEBUG` | `true` | `false` — a stack trace is currently returned on every unhandled error (see the full `NotFoundHttpException` trace this session hit when a request lacked `Accept: application/json`); this is the single most important flip before going live |
| `APP_URL` | `http://localhost:8000` | the real backend URL |
| `FRONTEND_URL` | `http://localhost:3001` | the real frontend URL — drives `config/cors.php`'s `allowed_origins` |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:3001,localhost,127.0.0.1` | the real frontend domain(s), no port-3001 dev entries |
| `SESSION_DOMAIN` | unset/local | the real apex/shared domain if frontend and backend are on different subdomains |
| `DB_*` | local MySQL | production credentials; confirm the app DB user has no more than the privileges it needs |
| `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` | sandbox test values | live merchant credentials |
| `PAYHERE_SANDBOX` | `true` | `false` |
| `PAYHERE_FEE_PERCENTAGE` | `3.3` (unconfirmed placeholder — see `config/services.php`'s comment) | **confirm the real PayHere fee schedule against the live merchant account before launch** — this number is baked into every `booking_financials.payment_processing_fee` and owner payable from the moment the first real payment confirms, and is not retroactively correctable without a ledger adjustment entry per booking |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` | dev defaults in `PlatformSeeder.php` | set real values via env **before** the first production `php artisan migrate --seed` — `PlatformSeeder` only runs once (`firstOrCreate`) |

## 2. Database

- `php artisan migrate --force` — **never** `migrate:fresh` against production.
- `php artisan db:seed --class=PlatformSeeder` (plus `AutomationSeeder`, `VehicleCategorySeeder`, `PlatformSettingSeeder`, `MenuSeeder`) — these are safe to re-run (`firstOrCreate`/truncate-and-reseed patterns) but **never** run `MarketplaceDemoSeeder` in production: it's gated behind an environment check in `DatabaseSeeder`, confirm that gate is still in place before the first production seed.
- `php artisan storage:link` — the public disk (vehicle photos) is served from `storage/app/public`; without the symlink every vehicle image 404s.

## 3. The scheduler — the one thing that silently does nothing without a server-level cron entry

`bootstrap/app.php`'s `withSchedule()` calls `Automation::scheduleAll($schedule)`, which reads the `automations` table (seeded active: booking expiry sweeps every 5 min, no-show flagging every 15 min, payout build daily at 02:00, DB backup every 10 min) and schedules each row's mapped console command. **None of this runs unless the server has:**

```
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

Without this cron entry, bookings never expire, holds never release, no-shows never get flagged, payouts never build, and backups never run — the app will look fine in manual testing and then quietly accumulate stuck `pending`/`accepted` bookings in production.

## 4. Queue worker — currently not required, but read this before adding one

`QUEUE_CONNECTION=database` is set, but nothing in the app currently implements `ShouldQueue` — `grep -rl ShouldQueue app/` returns only `MarketplaceNotification.php`, which deliberately does **not** implement it (see its docblock: this dev environment has no running `queue:work`, so a queued notification would never be delivered). This is fine today. **If a future change queues anything** (a queued notification, a queued job), a `queue:work` process (via Supervisor or similar) must be running in production, or that work will sit in the `jobs` table forever and be invisible until someone checks it.

## 5. CORS / Sanctum

- `config/cors.php`'s `allowed_origins` is `[env('FRONTEND_URL', ...)]` — single-origin by design; if the frontend is ever served from more than one origin (e.g. a staging subdomain), that needs explicit handling, not just a wildcard.
- `supports_credentials => true` plus `SANCTUM_STATEFUL_DOMAINS` must agree with the real frontend's exact host:port or the SPA's cookie-based session checks (`EnsureFrontendRequestsAreStateful`, already live on `statefulApi()`) will misbehave exactly the way this session's own `platform/login` debugging surfaced when an unrelated header was missing.

## 6. The log viewer

`routes/platform.php`'s `/log-viewer` route and `RestrictLogViewerToOwner` middleware already gate the opcodesio log viewer to the platform owner — confirm `APP_DEBUG=false` in production so the log viewer (not the default Laravel error page) is the only way logs are ever exposed.

## 7. Backups

`app/Console/Kernel`'s `backup:clean` runs hourly (hardcoded, piggybacking on the backup cadence, not admin-configurable — see `bootstrap/app.php`'s comment) and `Database Backup` runs every 10 minutes via the automations table. Confirm `config/backup.php`'s destination disk is a real off-box target in production, not local disk only — a backup that lives on the same server it's backing up doesn't survive the failure it exists for.

## 8. What Phase 8's test suite already covers, so this checklist doesn't need to

Covered by `tests/Feature/BookingConcurrencyTest.php`, `LedgerReconciliationTest.php`, and `DisputeAndInquiryBoundaryTest.php` (alongside the Phase 1 guard-rails in `ShopBoundaryTest.php` / `PublicScopeBoundaryTest.php`): double-booking under concurrent access, ledger double-entry balancing, deposits never counting as revenue, and cross-party/cross-shop data leaks on every feature added since Phase 1. None of that is re-litigated here — this file is only the server-level configuration those tests cannot exercise.
