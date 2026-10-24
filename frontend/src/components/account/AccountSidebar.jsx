"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { getIcon } from "@/lib/iconMap";
import { cn, getInitials } from "@/lib/utils";
import { BrandLogo } from "@/components/auth/BrandLogo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Car, LogOut, User as UserIcon, X } from "lucide-react";

function isRouteActive(pathname, route) {
  return !!route && (pathname === route || pathname.startsWith(route + "/"));
}

/**
 * The customer account app's sidebar — replaces the old flat top-bar
 * nav. Same data-driven nav items (useNavigationMenu("customer")), same
 * gradient accent the public pages use (aurora orange/pink/violet) kept
 * to the logo mark, the active nav row, and the avatar — not flooded
 * across the whole surface, so account data stays easy to read.
 */
export function AccountSidebar({ navigation, user, onLogout, isVendor, open = false, onClose }) {
  const pathname = usePathname();
  const items = navigation ?? [];

  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand?.name || "RentLanka";
  const logoUrl = brand?.logo || null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "flex h-screen w-72 shrink-0 flex-col border-r bg-card",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          "lg:static lg:translate-x-0 lg:w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
          <Link href="/account" onClick={onClose} className="flex min-w-0 items-center gap-2.5">
            <BrandLogo
              logoUrl={logoUrl}
              brandName={brandName}
              imgClassName="h-9 w-9 rounded-lg object-contain"
              fallbackClassName="size-9 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm"
              iconClassName="size-4"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none tracking-tight">{brandName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">My Account</p>
            </div>
          </Link>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-muted lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto thin-scrollbar px-3 py-4">
          {items.map((item) => {
            const Icon = getIcon(item.icon);
            const active = isRouteActive(pathname, item.route_name);
            return (
              <Link
                key={item.id}
                href={item.route_name}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}

          {isVendor && (
            <>
              <div className="my-3 border-t" />
              <Link
                href="/vendor/dashboard"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Car className="h-4 w-4 shrink-0" />
                Vendor dashboard
              </Link>
            </>
          )}
        </nav>

        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xs font-bold text-white">
                  {getInitials(user?.name ?? "")}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium leading-none">{user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account/profile">
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} variant="destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
