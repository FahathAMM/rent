# Frontend Structure

Next.js 15, App Router, plain JavaScript (`.jsx`/`.js`, no TypeScript). Almost every page/component is `"use client"` — this is an admin panel behind auth, not a content site needing SSR/SEO.

## Route groups

```
src/app/
├── (auth)/            login, register — no dashboard chrome
├── (dashboard)/        the tenant admin panel (see below)
└── platform/           the SaaS admin — entirely separate layout + auth store
```

### `(dashboard)/layout.jsx`

The shell every tenant page renders inside:

- Redirects to `/login` if not authenticated (`useAuthStore`).
- Fetches the permission-filtered nav tree once (`useNavigationMenu`) and renders `Header` (top module tabs) + `Sidebar` (active module's child tiles) around `{children}`.
- Tracks `activeModuleId` so the sidebar keeps showing the last-active module's tiles even on pages (like `/dashboard`) that don't belong to any module.
- Gates the page itself: if the current path isn't in the permission-filtered route list, renders `UnauthorizedView` instead of `children`.

### Page folders

One folder per route under `(dashboard)/`: `leads`, `customers`, `activities`, `quotations`, `invoices`, `payments`, `items`, `expenses`, `reports/{sales,expenses,aging,vat,customer-statement}`, `users`, `roles`, `menus`, `audit-logs`, `settings`, `dashboard`, `profile`. A detail page is `{folder}/[id]/page.jsx`; a dedicated create/edit page (where the form is too big for a modal) is `{folder}/new/page.jsx` or `{folder}/[id]/edit/page.jsx`.

## Shared component conventions

| Component | Used for |
|---|---|
| `HomePageWrapper` (`components/shared/`) | Wraps every **list** page: renders the breadcrumb, then a soft-bordered card (`max-w-7xl` by default) around the table |
| `PageWrapper` (`components/shared/`) | Wraps every **detail/form** page: same breadcrumb + card treatment, with an inner max-width constraint for the content |
| `DynamicBreadcrumb` | Renders the `Home > Section > Page` trail; takes an `items` array, used internally by both wrappers above (pass `breadcrumb={...}` to the wrapper — don't render this directly) |
| `ServerDataTable` (`components/Datatable/`) | The standard list-page table: server-side search/sort/pagination against a Laravel paginated endpoint |
| `ReportTable` (`components/Datatable/`) | Visual twin of `ServerDataTable` for pages whose full dataset is already in memory (the Reports pages) — search/sort/paginate run client-side, no extra network round trip |
| `Modal` (`components/Elements/`) | Wraps shadcn `Dialog` with a sticky header/footer (content scrolls between them), consistent sizing presets, and an optional `overlay={false}` to hide the backdrop |
| `ConfirmDialog` (`components/shared/`) | Wraps shadcn `AlertDialog` for delete/destructive-action confirmations |
| `ActivityFeed` (`components/shared/`) | The Log Activity / Timeline tabbed widget on Lead & Customer detail pages |
| `AttachmentPanel` (`components/shared/`) | File upload/list widget, works against the polymorphic `Attachment` API for any entity type |
| `DatePicker` (`components/forms/`) | Calendar-popover date field (`react-day-picker`-based), drop-in for a plain `YYYY-MM-DD` string — the standard date input across forms |
| `FormField` / `TextInput` / `SelectInput` / `Fieldset` (`components/forms/`) | Standard label+input+error wrapper used by every form |

## Data & state

- **Server data**: `@tanstack/react-query`, called through `src/services/*.js` — one file per resource, each a thin wrapper around the shared `axios` instance (`src/lib/axios.js`, which injects the bearer token and base URL from the auth store).
- **Client state**: `zustand` — `store/authStore.js` (tenant user, permissions, `can()` helper) and `store/platformAuthStore.js` (platform admin, entirely separate).
- **Currency/company formatting**: `useCompanyCurrencyFormat()` / `useCurrencyFormat()` hooks read the tenant's configured currency so amounts format consistently everywhere.
- **Permissions in components**: `usePermission()` hook exposes `can("{slug}-{action}")`, used to conditionally render Edit/Delete buttons per row — this is a UX nicety only; the API enforces the real check independently.

## Styling

Tailwind CSS, with shadcn/ui-style primitives in `components/ui/` (Radix-based: Dialog, AlertDialog, Select, Popover, Dropdown-menu, Tabs, Calendar, etc.) plus `tailwindcss-animate` for the `animate-in`/`fade-in-0`/`zoom-in-95` transition utilities those primitives use. A `cn()` helper (`clsx` + `tailwind-merge`) is used everywhere className logic branches.
