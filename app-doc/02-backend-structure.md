# Backend Structure

Everything is a single Laravel 13 app under `backend/`. There is one routes file, `routes/api.php`, split into three blocks:

1. **Public** — `POST /auth/login`, `POST /auth/register` (tenant self-signup, creates a `Company` + first `owner` user).
2. **Protected (tenant)** — everything behind `auth:sanctum` + `CheckSubscriptionStatus`. This is almost the entire file.
3. **Platform** — under `/platform/*`, behind the separate `platform` guard (see [Authentication & Multi-Tenancy](./03-authentication-and-multi-tenancy.md)). Never nested inside the tenant block.

## Controllers

`app/Http/Controllers/Api/` — one controller per resource, mostly thin wrappers around `apiResource` routes with Form Request validation:

`CustomerController`, `CustomerContactController`, `LeadController`, `LeadSourceController`, `LeadStageController`, `ActivityController`, `ItemController`, `UnitController`, `QuotationController`, `InvoiceController`, `PaymentController`, `PaymentMethodController`, `ExpenseController`, `ExpenseCategoryController`, `AttachmentController`, `TermTemplateController`, `TeamMemberController`, `CompanyController`, `CompanySettingController`, `SubscriptionController`, `ReportController`.

Sub-namespaces:

- `Api/Administration/` — `UserController`, `RoleController`, `PermissionController`, `MenuController`, `AuditLogController`, `StoreSettingController` (tenant-admin-only management screens).
- `Api/Auth/` — `AuthController` (tenant login/register/logout/me/profile/password).
- `Api/Dashboard/` — `DashboardController` (the CRM/sales/expense summary cards + charts on `/dashboard`).
- `Api/Platform/` — the entire SaaS-admin surface: `AuthController`, `DashboardController`, `CompanyController` (manage tenants — suspend/activate, view their users/activity), `PlanController`, `SubscriptionController`, `SystemAdminController` (platform admin accounts), `ImpersonationController` (platform admin can "log in as" a tenant user for support), `ActivityController`, `AuditLogController`.

## Services & Support classes

Business logic that's non-trivial or shared lives outside the controllers:

| Class | Responsibility |
|---|---|
| `AuthService` / `PlatformAuthService` | Login/token issuance for each guard |
| `AuthUser` | Guard-aware "who is the current user" resolver, used by `Tenant` (see auth doc) |
| `DashboardService` / `PlatformDashboardService` | Aggregates behind the two dashboards |
| `ReportService` | Sales, expense, aging, VAT, and customer-statement report queries |
| `SubscriptionService` | Plan changes, cancellation, usage limits |
| `AuditService` | Writes `AuditLog` rows (who did what, when, from where) |
| `ImpersonationService` | Platform admin → tenant user impersonation sessions |
| `App\Support\Tenant` | Resolves "current company" for scoping — see auth doc |
| `App\Support\NumberGenerator` | Sequential document numbers (`QUO-2026-00001`, `INV-2026-00001`, etc.) |
| `App\Support\DocumentTotals` | Shared subtotal/discount/tax/total math for quotations & invoices |
| `App\Support\InvoiceBalance` | Recomputes an invoice's paid/balance amounts from its payment allocations |
| `App\Support\PdfDocumentData` | Shapes a quotation/invoice into the data a Blade PDF template expects |
| `App\Support\Html` | Small HTML-escaping/formatting helpers used in PDF templates |

## Key models

`app/Models/` (plus `Administration/` for admin-only ones):

- **Tenant/company**: `Company`, `CompanySetting`, `Subscription`, `Plan`.
- **CRM**: `Lead`, `LeadSource`, `LeadStage`, `Customer`, `CustomerContact`, `Activity`.
- **Sales**: `Quotation`, `QuotationItem`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, `PaymentMethod`, `TermTemplate`.
- **Products**: `Item`, `Unit`.
- **Expenses**: `Expense`, `ExpenseCategory`.
- **Shared**: `Attachment` (polymorphic file uploads across customers/leads/quotations/invoices/expenses), `Administration\AuditLog`.
- **Admin/platform**: `Administration\User` (tenant users), `Administration\Menu` (drives the nav — see menus doc), `Administration\StoreSetting` (platform branding), `SystemAdmin` (platform admin accounts), `ImpersonationSession`.

Almost every tenant-owned model uses the `BelongsToCompany` trait (see next doc) — that's the single mechanism enforcing that Company A never sees Company B's rows.
