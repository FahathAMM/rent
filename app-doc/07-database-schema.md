# Database Schema Summary

Not a full column-by-column reference (the migrations in `backend/database/migrations/` are the source of truth for that) — this is a map of how the tables relate, grouped by area.

## Platform / tenancy

```
plans ──< subscriptions >── companies ──< company_settings
                                │
                                ├──< users (tenant staff — Administration\User)
                                └──< store_settings  (platform-wide branding, not per-company)

system_admins            (platform operators — separate from `users` entirely)
impersonation_sessions   (system_admin → user, for support access)
```

Every table below except `plans`, `system_admins`, and Spatie's permission tables carries a `company_id` foreign key and is filtered by `CompanyScope` (see [Authentication & Multi-Tenancy](./03-authentication-and-multi-tenancy.md)).

## Access control

```
roles / permissions / model_has_permissions / role_has_permissions / model_has_roles   (spatie/laravel-permission)
menus   (self-referencing parent_id — drives nav; see 04-roles-permissions-and-menus.md)
audit_logs   (user_id or system_admin_id + company_id, action, form, record_id, ip, browser)
```

## CRM

```
lead_sources, lead_stages   (company-configurable lookup lists)
leads ── belongs to lead_sources, lead_stages, users (assignee) ── may reference a converted customer
customers ──< customer_contacts
activities   (polymorphic: attachable to leads or customers via related_type/related_id)
```

## Sales

```
term_templates          (reusable T&Cs text, company-owned)
quotations ──< quotation line items (defined in the same migration as `quotations`)
     │  belongs to customers
     └── convert-to-invoice ──> invoices
invoices ──< invoice line items (defined alongside `invoices`)
     │  belongs to customers, optionally traces back to the source quotation
payment_methods          (platform defaults + per-company custom)
payments ──< payment allocations (defined alongside `payments`) >── invoices
     │  belongs to customers
```

A payment is created against a customer, then allocated across one or more of that customer's invoices; `InvoiceBalance` recomputes each invoice's paid/balance/status whenever allocations change.

## Products & Expenses

```
units            (platform defaults + per-company custom)
items ── belongs to units

expense_categories   (company-owned)
expenses ── belongs to expense_categories
```

## Cross-cutting

```
attachments   (polymorphic — attachable_type/attachable_id: customers, leads, quotations, invoices, expenses)
```

## Infrastructure tables

`personal_access_tokens` (Sanctum), `sessions`, `cache`, `jobs` — framework plumbing, not application data.
