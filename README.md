# Enscone — Multi-Tenant CRM & Invoicing SaaS

A Laravel + Next.js multi-tenant SaaS platform for UAE small businesses:
CRM (leads/customers), quotations, invoices, payments and expenses — each
company's data fully isolated from every other company's. Built on an
Administration core (authentication, users, roles & permissions, dynamic
navigation menus, key-value store settings, audit log) that every tenant
shares as its account/RBAC layer.


## Multi-tenancy

Every business signs up as its own **company** (tenant) via `/register`.
Tenant isolation is enforced server-side, not by convention:

- Every tenant-owned model uses the `BelongsToCompany` trait
  (`app/Models/Concerns/BelongsToCompany.php`), which adds a global
  `CompanyScope` to every query and stamps `company_id` from the
  **authenticated user**, not from request input — a `company_id` sent in
  a request body is always ignored.
- `App\Support\Tenant` resolves "the current company" from `Auth::user()`.
  A **platform super-admin** (no company of their own) bypasses the scope
  and can see every tenant — used for platform operations, not day-to-day
  business use.
- See `tests/Feature/TenantIsolationTest.php` for the isolation
  guarantees this enforces (list/show/update/delete/create all denied or
  scoped across tenants, even when an ID is guessed/forged).

Roles are **shared definitions** across every tenant (`owner`, `admin`,
`sales`, `accountant`, `staff`, plus the platform-only `super-admin`) —
that's safe because access to *data* is enforced per-row by `CompanyScope`,
not by the role system. `owner`/`admin` manage their own company's users,
profile and numbering/tax settings; only `super-admin` may edit shared
platform configuration (menus, role definitions, platform branding).

## Architecture

```
enscone/
├── backend/     # Laravel REST API
└── frontend/    # Next.js App
```

## Quick Start

### 1. Start Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# Edit .env with your DB credentials
php artisan migrate
php artisan db:seed
php artisan storage:link
php artisan serve
```

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev -- --port=3001
```

Or run both at once from the repo root with `./dev.sh` (`dev.ps1`/`dev.bat`
on Windows) — backend on :8001, frontend on :3001.

### 3. Login
- URL: http://localhost:3001/login
- Create a new company: http://localhost:3001/register
- Demo Company (Demo Trading LLC) — Owner: admin@pos.com / password
- Demo Company — Staff: staff@pos.com / password
- Demo Company — Sales: sales@enscone.test / password
- Demo Company — Accountant: accountant@enscone.test / password
- Second tenant (Al Noor Trading), for testing isolation — Owner: owner2@enscone.test / password
- Platform super-admin (sees every company): fahathammex90@gmail.com / fahath@123

## Features
- Authentication (Sanctum), registration (company + owner signup, trial
  subscription), profile, change password
- **Multi-tenancy**: every company's data is isolated server-side (see
  above) — verified by `tests/Feature/TenantIsolationTest.php`
- User management, scoped to your own company (owner/admin)
- Role-based access control (Spatie permissions): owner, admin, sales,
  accountant, staff (per tenant) + super-admin (platform)
- Company profile & numbering/tax settings (`/settings/company`)
- **Plans & subscriptions** (`/settings/subscription`, owner/admin): a
  14-day trial on signup, 3 plans (Starter/Business/Professional) capping
  users/customers/invoices, switch-plan and cancel actions. A cancelled or
  expired-trial company is locked to read-only — every non-GET request
  outside auth/subscription/plans gets a `402` (`App\Http\Middleware\
  CheckSubscriptionStatus`) — while creating past a plan's own cap is
  rejected per-resource with a normal `422`
  (`App\Services\SubscriptionService::assertWithinLimit`, wired into user/
  customer/invoice creation). See `tests/Feature/SubscriptionTest.php` and
  `tests/Feature/SubscriptionLimitTest.php`. A dashboard-wide banner warns
  when a trial is ending soon or the account is blocked.
- Safe sequential document numbering (`App\Support\NumberGenerator`),
  concurrency-safe via row locking — customers, leads, quotations, invoices
- Dynamic navigation menus, driven by DB data and filtered per role
- Store settings (key-value, platform branding — super-admin only)
- Audit log (who did what, when) — scoped to your own company
- Dashboard with basic admin stats
- **CRM**: leads (with sources/stages, convert-to-customer), customers
  (with contacts, credit limit, payment terms), an activity feed (calls/
  meetings/notes) attachable to any customer, lead, quotation or invoice
- **Sales**: products & services catalog (`items`, `units` — units have
  platform-wide defaults plus per-company custom ones), quotations with a
  full send → accept/reject → convert-to-invoice lifecycle, and invoices
  born from a converted quotation
- **Financial calculations are server-authoritative**: the frontend only
  ever sends quantity/price/discount/tax inputs — `App\Support\DocumentTotals`
  computes subtotal → discount → taxable → tax → total for every quotation/
  invoice line and header; nothing resembling a `total` field sent by a
  client is ever trusted (see `tests/Feature/QuotationTest.php`)
- Quotation/invoice **PDF** export (`barryvdh/laravel-dompdf`), with the
  company logo, TRN, customer details and the same totals breakdown as the
  UI — `resources/views/pdf/document.blade.php`
- A daily scheduled command (`invoices:mark-overdue`) flips invoices past
  their due date to `overdue`
- **Invoicing**: standalone invoice creation (not just from a quotation),
  send/cancel, and financial-integrity rules — once an invoice has any
  recorded payment, its line items/totals are frozen server-side and it can
  no longer be deleted or cancelled (spec section 31)
- **Payments**: one payment can be split across multiple invoices
  (`payment_allocations`), or recorded against a single invoice via the
  invoice's own "Record Payment" action. Every invoice's `paid_amount`/
  `balance_amount`/`status` is *recomputed from the sum of its allocations*
  on every write — never trusted from the frontend, and never adjusted
  incrementally — see `App\Support\InvoiceBalance` and
  `tests/Feature/PaymentTest.php` (over-allocation, cross-customer
  allocation, and payment deletion all reverse cleanly)
- Payment methods (`Cash`, `Bank Transfer`, ... platform defaults + per-
  company custom ones, same pattern as units)
- **Expenses**: per-company expense categories (seeded with sensible
  defaults — Office Rent, Fuel, Salary, Internet, Marketing, Transport,
  Utilities, Other — on registration, and manageable from the Expenses
  page), sequentially numbered expense records with server-computed VAT,
  optional payment method and receipt upload
- **Attachments**: a single polymorphic `attachments` table backs file
  uploads on customers, leads, quotations, invoices and expenses.
  Authorization is generic — the controller resolves the parent record and
  defers to that model's own Policy (`view`/`update`), so no per-module
  permission logic is duplicated. Customer detail pages also surface a full
  history — linked quotations, invoices and payments, plus computed Total
  Invoiced / Total Paid / Outstanding Balance
- **Dashboard**: business KPIs (customers, open leads, outstanding balance,
  overdue invoices, this month's revenue/expenses/net), a 6-month revenue
  vs. expenses chart, expense-by-category breakdown, open-lead pipeline by
  stage, recent invoices/payments and top customers by revenue — all scoped
  to the signed-in company automatically (`App\Services\DashboardService`,
  same `CompanyScope` isolation as everywhere else, see
  `tests/Feature/DashboardTest.php`)
- **Reports** (`/reports`, owner/admin/accountant only): a Sales report
  (invoices in a date range with totals invoiced/paid/outstanding), an
  Expense report (date range + category filter, spend by category), an
  Aging/Outstanding report (unpaid invoices bucketed Current / 1-30 / 31-60
  / 61-90 / 90+ days overdue), a **VAT Summary** (output VAT from sales vs.
  input VAT from expenses, netted month-by-month — sized for preparing a
  UAE FTA VAT return), and a **Customer Statement** (a customer's running
  ledger — every invoice and payment chronologically, opening balance
  carried into the selected range, closing balance at the end) —
  `App\Services\ReportService`, `tests/Feature/ReportTest.php`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register a new company + owner account |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| PUT | /api/auth/profile | Update profile |
| PUT | /api/auth/change-password | Change password |
| GET | /api/dashboard | Dashboard stats |
| GET/PUT | /api/company | Your company profile (owner/admin) |
| GET/PUT | /api/company-settings | Numbering & tax defaults (owner/admin) |
| GET/POST/PUT/DELETE | /api/users | Users, scoped to your company (owner/admin) |
| GET | /api/menus/navigation | Navigation tree (filtered by your permissions) |
| GET | /api/settings | Read platform branding settings |
| GET | /api/audit-logs | Audit trail for your company (owner/admin) |
| GET/POST/PUT/DELETE | /api/roles | Role definitions (super-admin only — shared platform-wide) |
| GET | /api/permissions | Permissions (super-admin only) |
| GET/POST/PUT/DELETE | /api/menus | Menu management (super-admin only) |
| PUT | /api/settings/{group} | Update platform branding (super-admin only) |
| GET/POST/PUT/DELETE | /api/customers | Customers |
| GET/POST/PUT/DELETE | /api/customers/{id}/contacts | Customer contacts |
| GET/POST/PUT/DELETE | /api/leads | Leads |
| POST | /api/leads/{id}/convert-to-customer | Convert a lead to a customer |
| GET/POST/PUT/DELETE | /api/lead-sources, /api/lead-stages | Pipeline config |
| GET/POST/PUT/DELETE | /api/activities | Activity feed (call/meeting/note/...) |
| GET/POST/PUT/DELETE | /api/units, /api/items | Products & services catalog |
| GET/POST/PUT/DELETE | /api/quotations | Quotations |
| POST | /api/quotations/{id}/send\|accept\|reject | Quotation status transitions |
| POST | /api/quotations/{id}/convert-to-invoice | Convert an accepted quotation to an invoice |
| GET | /api/quotations/{id}/pdf, /api/invoices/{id}/pdf | Download PDF |
| GET/POST/PUT/DELETE | /api/invoices | Invoices |
| POST | /api/invoices/{id}/send\|cancel | Invoice status transitions |
| POST | /api/invoices/{id}/payments | Record a payment against just this invoice |
| GET/POST/PUT/DELETE | /api/payment-methods | Payment methods (platform defaults + per-company) |
| GET/POST/DELETE | /api/payments | Payments (one payment can allocate across many invoices) |
| POST | /api/payments/{id}/allocate | Allocate more of an existing payment |
| GET/POST/PUT/DELETE | /api/expense-categories | Expense categories (per-company) |
| GET/POST/PUT/DELETE | /api/expenses | Expenses (server-computed VAT, optional receipt upload) |
| GET/POST/DELETE | /api/attachments | Polymorphic attachments (customer/lead/quotation/invoice/expense) |
| GET | /api/reports/sales | Sales report (`date_from`/`date_to`) — owner/admin/accountant |
| GET | /api/reports/expenses | Expense report (`date_from`/`date_to`/`expense_category_id`) — owner/admin/accountant |
| GET | /api/reports/aging | Outstanding-invoice aging report — owner/admin/accountant |
| GET | /api/reports/vat | VAT summary (`date_from`/`date_to`), output vs. input VAT by month — owner/admin/accountant |
| GET | /api/reports/customer-statement | A customer's running ledger (`customer_id`, `date_from`/`date_to`) — owner/admin/accountant |
| GET | /api/subscription | Current subscription, plan and usage vs. limits — owner/admin |
| GET | /api/plans | Active plans available to switch to — owner/admin |
| POST | /api/subscription/change-plan | Switch the company onto a different plan — owner/admin |
| POST | /api/subscription/cancel | Cancel the current subscription — owner/admin |

## Testing

```bash
cd backend
php artisan test
```

131 feature tests, all passing — `phpunit.xml.dist` points at a dedicated
`pos_db_test` database so a test run never touches your dev data. Coverage
spans every phase: tenant isolation (`TenantIsolationTest`), auth &
registration, the full CRM/Sales/Invoicing lifecycle (leads → customers →
quotations → invoices → payments, including allocation and forged-total
edge cases), expenses & polymorphic attachments, role/permission boundaries
(including `RoleTest`'s super-admin-only enforcement), dashboard/report
aggregation correctness (including the VAT and customer-statement running
balance math), and subscription limit + lockout behavior.

Frontend: `cd frontend && npm run build` compiles every route with zero
errors (only pre-existing cosmetic `<img>` lint warnings, unrelated to
functionality).

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for a Docker Compose setup (single
command, single host) and a split-hosting path (any Laravel host + Vercel).
Covers environment variables, the scheduler (`invoices:mark-overdue`),
`storage:link`, and a pre-launch security checklist.
