"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import {
  LayoutDashboard, Building2, Users, ScrollText,
  CreditCard, Package, Settings, LogOut, ShieldCheck, X,
  FileSearch, ExternalLink,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/companies", label: "Companies", icon: Building2 },
  { href: "/platform/users", label: "Users", icon: Users },
  { href: "/platform/audit-logs", label: "Audit Logs", icon: ScrollText },
  // /platform/logs (custom log viewer) temporarily hidden from nav — the
  // page and its API routes still work if linked to directly.
  { href: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/platform/plans", label: "Plans", icon: Package },
  { href: "/platform/settings", label: "Settings", icon: Settings },
];

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function PlatformSidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const { admin, token, logout } = usePlatformAuth();

  // Full application log browser (opcodesio/log-viewer) — server-rendered by
  // the backend itself, not a Next.js page, so it opens in a new tab rather
  // than routing through the SPA layout. Same-origin via the /log-viewer
  // rewrite in next.config.mjs. The `token` query param is only needed for
  // this first request — RestrictLogViewerToOwner checks it identifies the
  // platform owner, then remembers that in the session for the page's own
  // follow-up AJAX calls.
  const navItems = [
    ...NAV_ITEMS,
    { href: `/log-viewer?token=${encodeURIComponent(token ?? "")}`, label: "Log Viewer", icon: FileSearch, external: true },
  ];

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
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-white">MyBiz2Flow</p>
              <p className="text-[11px] text-slate-400 mt-1">Platform Admin</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="lg:hidden rounded-md p-1.5 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto thin-scrollbar px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = !item.external && isActive(pathname, item.href);
            const className = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-500/15 text-indigo-300"
                : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
            );

            if (item.external) {
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 ml-auto opacity-60" />
                </a>
              );
            }

            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={className}>
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
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
