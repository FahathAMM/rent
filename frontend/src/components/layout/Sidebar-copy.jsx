"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/iconMap";
import { Check, ChevronDown, Store, X, Linkedin, Globe } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { visitService } from "@/services/visitService";
import { TILE_COLORS } from "@/lib/tileColors";

function isRouteActive(pathname, route) {
  return !!route && (pathname === route || pathname.startsWith(route + "/"));
}

function sectionHasActiveChild(item, pathname) {
  return item.children?.some((c) => isRouteActive(pathname, c.route_name));
}

// ── Start-menu-style tile — two per row in the sidebar grid ──────────────────
function NavTile({ item, pathname, onNavigate, colorClass }) {
  const Icon = getIcon(item.icon);
  const isActive = isRouteActive(pathname, item.route_name);

  return (
    <Link
      href={item.route_name}
      onClick={onNavigate}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center gap-2 rounded-md p-2 text-center text-white shadow-sm transition-all hover:scale-[1.03]",
        colorClass
      )}
    >
      <Icon className="h-7 w-7 shrink-0" />
      <span className="text-xs font-semibold leading-tight px-1 line-clamp-2">{item.name}</span>
      {isActive && (
        <>
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-2 ring-sidebar">
            <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
          </span>
          <span className="absolute bottom-1.5 h-1 w-8 rounded-full bg-white" />
        </>
      )}
    </Link>
  );
}

// ── Collapsible parent (has route_name AND children) — spans both columns ────
function CollapsibleItem({ item, pathname, depth, onNavigate }) {
  const Icon = getIcon(item.icon);
  const isActive = isRouteActive(pathname, item.route_name);
  const hasActiveChild = sectionHasActiveChild(item, pathname);
  const [expanded, setExpanded] = useState(isActive || hasActiveChild);
  const indent = 12 + depth * 16;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "relative w-full flex items-center gap-3 min-h-[3rem] rounded-lg text-sm font-medium transition-colors",
          isActive || hasActiveChild
            ? "bg-sidebar-primary/15 text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${indent}px`, paddingRight: "10px" }}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            (isActive || hasActiveChild) ? "bg-sidebar-primary/15" : "bg-sidebar-accent/60"
          )}
        >
          <Icon className="h-6 w-6 shrink-0" />
        </span>
        <span className="flex-1 text-left truncate">{item.name}</span>
        {isActive && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
        />
        {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-sidebar-primary" />}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="space-y-1 pt-1">
            {item.children.map((child) => (
              <NavLink key={child.id} item={child} pathname={pathname} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plain list-style link — used for nested children only ────────────────────
function NavLink({ item, pathname, depth, onNavigate }) {
  const Icon = getIcon(item.icon);
  const route = item.route_name;
  const isActive = isRouteActive(pathname, route);
  const indent = 12 + depth * 16;

  return (
    <Link
      href={route}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 min-h-[3rem] rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      style={{ paddingLeft: `${indent}px`, paddingRight: "10px" }}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          isActive ? "bg-sidebar-primary-foreground/20" : "bg-sidebar-accent/60"
        )}
      >
        <Icon className="h-6 w-6 shrink-0" />
      </span>
      <span className="truncate flex-1">{item.name}</span>
      {isActive && (
        <>
          <Check className="h-4 w-4 shrink-0 mr-1" strokeWidth={3} />
          <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-white/70" />
        </>
      )}
    </Link>
  );
}

// ── Sidebar — Start-menu-style tile grid for the active module's pages ───────
export function Sidebar({ activeModule, navigation, open = false, onClose }) {
  const pathname = usePathname();
  const standaloneItems = navigation?.filter((item) => item.route_name) ?? [];

  const { data: brand = {} } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand.name || "MyBiz2Flow";
  const tagline   = brand.tagline || "One Flow. One Business.";
  const logoUrl   = brand.logo || null;

  return (
    <>
      {/* Mobile/tablet backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-72 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          "lg:translate-x-0 lg:w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 border-b border-sidebar-border p-3">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5 shadow-sm transition-colors hover:bg-sidebar-accent/50"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-8 w-8 rounded-lg object-contain shrink-0 ring-1 ring-sidebar-border bg-sidebar shadow-sm" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shrink-0 shadow-sm">
                <Store className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm tracking-tight truncate">{brandName}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{tagline}</p>
            </div>
          </Link>
          <button type="button" onClick={onClose} className="lg:hidden p-2 rounded-md hover:bg-sidebar-accent/50 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tile grid — Dashboard + the active module's pages, two per row */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto thin-scrollbar">
          {activeModule && (
            <p className="px-1 mb-2 text-xs font-bold uppercase tracking-widest text-sidebar-foreground/40 select-none">
              {activeModule.name}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {standaloneItems.map((item, i) => (
              <NavTile key={item.id} item={item} pathname={pathname} onNavigate={onClose} colorClass={TILE_COLORS[i % TILE_COLORS.length]} />
            ))}

            {activeModule?.children?.map((item, i) =>
              item.children?.length ? (
                <div key={item.id} className="col-span-2">
                  <CollapsibleItem item={item} pathname={pathname} depth={0} onNavigate={onClose} />
                </div>
              ) : (
                <NavTile
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  onNavigate={onClose}
                  colorClass={TILE_COLORS[(standaloneItems.length + i) % TILE_COLORS.length]}
                />
              )
            )}
          </div>
        </nav>

        {/* Developer credit */}
        <div className="border-t border-sidebar-border px-4 py-3 shrink-0 space-y-1.5">
          <p className="text-xs text-sidebar-foreground/50 truncate">Developed by Fahath Mohamed</p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/fahath-mohamed-3ab47416b/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => visitService.track("linkedin_click")}
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5 shrink-0" />
              LinkedIn
            </a>
            <a
              href="https://fahathamm.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => visitService.track("website_click")}
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              Portfolio
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
