"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useNavigationMenu } from "@/hooks/useMenus";
import { useAuth } from "@/hooks/useAuth";
import { getIcon } from "@/lib/iconMap";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import { BrandLogo } from "@/components/auth/BrandLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function isRouteActive(pathname, route) {
  return !!route && (pathname === route || pathname.startsWith(route + "/"));
}

/**
 * The customer-facing account app - a flat, 4-item nav (dashboard,
 * bookings, favorites, profile), unlike the vendor app's module-tab/tile
 * sidebar. Much simpler chrome is appropriate: a plain top bar, no
 * ShopSwitcher (a customer has no shop context at all).
 */
export default function AccountLayout({ children }) {
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data: navigation, isLoading: navLoading } = useNavigationMenu("customer");

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, _hasHydrated, router]);

  if (!_hasHydrated || !isAuthenticated || navLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = navigation ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/account" className="flex items-center gap-2 shrink-0">
            <BrandLogo
              fallbackClassName="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
              iconClassName="size-4"
            />
            <span className="hidden sm:inline text-sm font-semibold tracking-tight">RentLanka</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {items.map((item) => {
              const Icon = getIcon(item.icon);
              const active = isRouteActive(pathname, item.route_name);
              return (
                <Link
                  key={item.id}
                  href={item.route_name}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border px-2 py-1.5 hover:bg-muted transition-colors shrink-0">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UserIcon className="size-3.5" />
                </span>
                <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/account/profile">
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} variant="destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
