# Architecture Overview

## Two identities, one codebase

MyBiz2Flow actually serves two distinct audiences from one Laravel backend and one Next.js frontend:

1. **Tenant Admin Panel** — what a company (a salon, a trading business, a services firm, etc.) uses day to day: CRM, quotations, invoices, expenses, reports. Routes live under `frontend/src/app/(dashboard)/...`.
2. **Platform (SaaS) Admin** — MyBiz2Flow's own operators, who manage every tenant company, subscription plans, and platform-wide settings. Routes live under `frontend/src/app/platform/...`.

These two are kept **completely separate at the auth layer** (different Sanctum guards, different login endpoints, different user tables) — see [Authentication & Multi-Tenancy](./03-authentication-and-multi-tenancy.md). A tenant user's token is rejected outright if used against a platform endpoint, and vice versa.

## Request flow (tenant side)

```
Browser (Next.js, "use client" pages)
   │  axios (Bearer token from Zustand-persisted auth store)
   ▼
routes/api.php  ── auth:sanctum + CheckSubscriptionStatus middleware
   │
   ▼
Controller (Api\*Controller)  ── validates request, calls a Service where logic is non-trivial
   │
   ▼
Eloquent Model  ── BelongsToCompany trait auto-applies CompanyScope (tenant isolation)
   │
   ▼
MySQL
```

Most CRUD endpoints are plain Laravel `apiResource` routes hitting a controller directly. Anything with real business logic (document totals, number generation, PDF rendering, invoice balance recalculation, reporting aggregations) is pulled into an `app/Services/*` or `app/Support/*` class rather than living in the controller — e.g. `ReportService`, `NumberGenerator`, `DocumentTotals`, `InvoiceBalance`, `PdfDocumentData`.

## Frontend composition

The Next.js app is JavaScript-only (no TypeScript) and uses the App Router with route groups:

- `(auth)` — login/register, no sidebar chrome.
- `(dashboard)` — the tenant admin panel; `layout.jsx` here fetches the permission-filtered navigation tree once and renders the shared `Header` (top module tabs) + `Sidebar` (child-page tiles) around every page.
- `platform/` — the SaaS admin, with its own layout and its own auth store, entirely independent of the tenant `(dashboard)` layout.

Data fetching on every page is `@tanstack/react-query` calling thin `src/services/*.js` wrappers around a shared `axios` instance (`src/lib/axios.js`), which attaches the bearer token and base URL. Client-only state (the logged-in user, permission list, sidebar open/closed) lives in `zustand` stores (`src/store/*`).

## Why a service layer at all

Controllers stay thin and are the easiest place to see *what* an endpoint does; anything reused across endpoints, or complex enough to unit test in isolation (VAT math, aging buckets, PDF payload shaping), is factored into a service/support class so it isn't duplicated between, say, the invoice PDF and the sales report.
