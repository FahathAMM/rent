"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ChevronDownIcon, ChevronLeft, ChevronRight, LogOutIcon, Menu, SettingsIcon, UserIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/iconMap";
import { TILE_COLORS } from "@/lib/tileColors";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { NotificationBell } from "@/components/shared/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Previous version — stacked icon-over-label tile (w-24 h-14). Kept here
// for easy revert; the horizontal pill below is the active default.
// function ModuleTab({ item, isActive, colorClass }) {
//   const Icon = getIcon(item.icon);
//   const href = item.children?.[0]?.route_name;
//   if (!href) return null;
//
//   return (
//     <Link
//       href={href}
//       className={cn(
//         "relative flex w-24 h-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md text-white shadow-sm transition-transform hover:scale-[1.05]",
//         colorClass
//       )}
//     >
//       <Icon className="h-5 w-5 shrink-0" />
//       <span className="text-[10px] font-semibold leading-tight text-center px-1 line-clamp-2">{item.name}</span>
//       {isActive && (
//         <>
//           <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-2 ring-background">
//             <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
//           </span>
//           <span className="absolute bottom-1 h-1 w-8 rounded-full bg-white" />
//         </>
//       )}
//     </Link>
//   );
// }

function ModuleTab({ item, isActive, colorClass }) {
  const Icon = getIcon(item.icon);
  const href = item.children?.[0]?.route_name;
  if (!href) return null;

  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-white shadow-sm transition-transform hover:scale-[1.05]",
        colorClass
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-xs font-semibold">{item.name}</span>
      {isActive && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-2 ring-background">
          <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
        </span>
      )}
    </Link>
  );
}

export function Header({ navigation, activeModuleId, onMenuClick }) {
  const modules = navigation?.filter((item) => !item.route_name && item.children?.length) ?? [];
  const { logout } = useAuth();
  const { user } = useAuthStore();

  const navRef = useRef(null);
  const scrollNav = (dir) => navRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [navOverflows, setNavOverflows] = useState(false);

  const updateScrollState = () => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setNavOverflows(el.scrollWidth > el.clientWidth + 1);
  };

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [modules.length]);

  return (
    // Below `lg` (where the sidebar is a drawer, not static) the header
    // docks to the bottom of the screen instead — thumb-reachable nav beats
    // a bar you have to stretch up to on a phone. Radix's dropdown/popper
    // positioning auto-flips upward on its own when the trigger sits this
    // close to the bottom, so the user menu needs no extra handling.
    <header className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:border-t-0 lg:border-b lg:pb-0">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden shrink-0" title="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="group relative flex-1 min-w-0">
          {canScrollLeft && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -left-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-border bg-card opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              onClick={() => scrollNav(-1)}
              title="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <nav
            ref={navRef}
            className={cn(
              "flex w-full items-center gap-2 overflow-x-auto no-scrollbar min-w-0 rounded-xl border bg-card px-2 py-1.5 shadow-sm",
              !navOverflows && "justify-center"
            )}
          >
            {modules.map((item, i) => (
              <ModuleTab key={item.id} item={item} isActive={item.id === activeModuleId} colorClass={TILE_COLORS[i % TILE_COLORS.length]} />
            ))}
          </nav>

          {canScrollRight && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -right-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-border bg-card opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              onClick={() => scrollNav(1)}
              title="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <NotificationBell />

        <div className="h-8 w-px bg-border shrink-0" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto shrink-0 gap-1.5 rounded-xl border bg-card px-2 py-1.5 shadow-sm hover:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <UserIcon className="size-3.5" />
              </div>
              <div className="hidden sm:flex flex-col items-start leading-tight min-w-0">
                <span className="text-sm font-medium truncate">{user?.name}</span>
              </div>
              <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 py-2">
                <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <UserIcon className="size-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-foreground text-sm font-medium truncate">{user?.name}</span>
                  <span className="text-muted-foreground text-xs font-normal truncate">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/vendor/profile">
                  <UserIcon aria-hidden="true" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/vendor/settings/shop">
                  <SettingsIcon aria-hidden="true" />
                  Shop Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/vendor/staff">
                  <UsersIcon aria-hidden="true" />
                  Staff
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOutIcon aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
