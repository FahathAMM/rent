"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import {
  LayoutDashboard, Building2, Users, ScrollText,
  Settings, LogOut, ShieldCheck, X, UserCheck, Car, Banknote, Star,
  FileSearch, ExternalLink, AlertTriangle, Flag, CalendarCheck, Tag, BadgeCheck, Layers, Palette,
  Percent, CreditCard, Undo2, Scale, MapPin, GalleryHorizontal, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// /platform/logs (custom log viewer) temporarily hidden from nav — the
// page and its API routes still work if linked to directly. The external
// Log Viewer link is appended to "System" at render time (needs the token).
const NAV_GROUPS = [
  {
    id: "overview", label: "Overview",
    items: [{ href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "marketplace", label: "Marketplace",
    items: [
      { href: "/platform/shops", label: "Shop Verification", icon: Building2 },
      { href: "/platform/listings", label: "Listing Moderation", icon: Car },
      { href: "/platform/customers", label: "Customers", icon: UserCheck },
      { href: "/platform/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/platform/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    id: "catalogue", label: "Catalogue",
    items: [
      { href: "/platform/categories", label: "Categories", icon: Tag },
      { href: "/platform/brands", label: "Brands", icon: BadgeCheck },
      { href: "/platform/vehicle-models", label: "Models & Variants", icon: Layers },
      { href: "/platform/vehicle-colours", label: "Colours", icon: Palette },
      { href: "/platform/cities", label: "Districts & Cities", icon: MapPin },
    ],
  },
  {
    id: "website", label: "Website",
    items: [{ href: "/platform/hero-slides", label: "Hero Slides", icon: GalleryHorizontal }],
  },
  {
    id: "finance", label: "Finance",
    items: [
      { href: "/platform/payments", label: "Payments", icon: CreditCard },
      { href: "/platform/refunds", label: "Refunds", icon: Undo2 },
      { href: "/platform/payouts", label: "Payouts", icon: Banknote },
      { href: "/platform/commissions", label: "Commissions", icon: Percent },
      { href: "/platform/reconciliation", label: "Reconciliation", icon: Scale },
    ],
  },
  {
    id: "trust", label: "Trust & Safety",
    items: [
      { href: "/platform/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/platform/abuse-reports", label: "Abuse Reports", icon: Flag },
    ],
  },
  {
    id: "system", label: "System",
    items: [
      { href: "/platform/users", label: "Users", icon: Users },
      { href: "/platform/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/platform/settings", label: "Settings", icon: Settings },
    ],
  },
];

const COLLAPSED_KEY = "platform-sidebar-collapsed";

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function PlatformSidebar({ open = false, onClose }) {
  // Same public branding the marketing site and vendor sidebar use.
  const { data: brand = {} } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand.name || "LankaLane";
  const pathname = usePathname();
  const { admin, token, logout } = usePlatformAuth();

  // Full application log browser (opcodesio/log-viewer) — server-rendered by
  // the backend itself, not a Next.js page, so it opens in a new tab rather
  // than routing through the SPA layout. Same-origin via the /log-viewer
  // rewrite in next.config.mjs. The `token` query param is only needed for
  // this first request — RestrictLogViewerToOwner checks it identifies the
  // platform owner, then remembers that in the session for the page's own
  // follow-up AJAX calls.
  const groups = NAV_GROUPS.map((g) => (g.id !== "system" ? g : {
    ...g,
    items: [
      ...g.items.slice(0, 2),
      { href: `/log-viewer?token=${encodeURIComponent(token ?? "")}`, label: "Log Viewer", icon: FileSearch, external: true },
      ...g.items.slice(2),
    ],
  }));

  // Collapsed groups are a per-browser convenience; the group holding the
  // current page is always shown open regardless.
  const [collapsed, setCollapsed] = useState([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(saved);
    } catch {}
  }, []);
  const toggleGroup = (id) => setCollapsed((prev) => {
    const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
    return next;
  });

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "w-72 min-h-screen bg-slate-950 text-slate-200 flex flex-col border-r border-slate-800",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          "lg:static lg:translate-x-0 lg:w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-4">
          {/* The app name opens the public site in a new tab, keeping the admin open. */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the public website"
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-800/60"
          >
            {brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt={brandName} className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-none text-white">{brandName}</p>
              <p className="text-[11px] text-slate-400 mt-1">Platform Admin</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          <button type="button" onClick={onClose} className="lg:hidden rounded-md p-1.5 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto thin-scrollbar px-3 py-4">
          {groups.map((group) => {
            const hasActive = group.items.some((item) => !item.external && isActive(pathname, item.href));
            // Single-link groups (Overview, Website) don't collapse.
            const collapsible = group.items.length > 1;
            const isOpen = !collapsible || hasActive || !collapsed.includes(group.id);

            return (
              <div key={group.id}>
                {collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                  >
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                ) : (
                  <p className="mb-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                )}

                {isOpen && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = !item.external && isActive(pathname, item.href);
                      const className = cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-500/15 text-indigo-300"
                          : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                      );
                      const marker = active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-indigo-400" />;

                      if (item.external) {
                        return (
                          <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                            <Icon className="h-[18px] w-[18px] shrink-0" />
                            {item.label}
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 ml-auto opacity-60" />
                          </a>
                        );
                      }

                      return (
                        <Link key={item.href} href={item.href} onClick={onClose} className={className} aria-current={active ? "page" : undefined}>
                          {marker}
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 hover:bg-slate-800/70">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                  {getInitials(admin?.name ?? "")}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium leading-none text-white">{admin?.name}</p>
                  <p className="truncate text-xs text-slate-400 capitalize">{admin?.role?.replace("_", " ")}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium leading-none">{admin?.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{admin?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/platform/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
