# MyBiz2Flow — Application Documentation

MyBiz2Flow is a multi-tenant CRM & Invoicing SaaS built for UAE small businesses. It covers the full sales lifecycle — leads → quotations → invoices → payments — plus expense tracking, VAT-aware financial reports, and a platform-level "SaaS admin" layer for managing tenant companies and subscriptions.

## Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13 (PHP 8.3), MySQL |
| Auth | Laravel Sanctum (two separate guards — see [Authentication & Multi-Tenancy](./03-authentication-and-multi-tenancy.md)) |
| Permissions | `spatie/laravel-permission` (roles + granular `{slug}-{action}` permissions) |
| PDF generation | `barryvdh/laravel-dompdf` |
| Frontend | Next.js 15 (App Router, JavaScript only, no TypeScript) |
| UI | Tailwind CSS + shadcn/ui-style components (Radix primitives), `tailwindcss-animate` |
| Data fetching | `@tanstack/react-query` |
| Client state | `zustand` |
| Date handling | `date-fns`, `react-day-picker` |
| HTTP client | `axios` |

## Documentation Index

1. [Architecture Overview](./01-architecture-overview.md) — how the two Next.js "apps" (tenant admin panel + platform SaaS admin) and the one Laravel backend fit together.
2. [Backend Structure](./02-backend-structure.md) — models, controllers, services, API route map.
3. [Authentication & Multi-Tenancy](./03-authentication-and-multi-tenancy.md) — the two auth guards, and exactly how tenant data isolation is enforced.
4. [Roles, Permissions & Menus](./04-roles-permissions-and-menus.md) — how the sidebar/top-nav is data-driven, and how access control ties into it.
5. [Business Modules](./05-business-modules.md) — CRM, Sales, Products & Services, Expenses, Reports, one section each.
6. [Frontend Structure](./06-frontend-structure.md) — Next.js route layout, shared component conventions, page patterns.
7. [Database Schema Summary](./07-database-schema.md) — key tables and how they relate.

## Where things live

```
enscone/
├── backend/     Laravel API (routes/api.php is the single entry point)
├── frontend/    Next.js admin panel + platform SaaS admin (one app, two route groups)
└── app-doc/     ← you are here
```
