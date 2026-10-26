"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import { Menu, Store, LayoutDashboard, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse Vehicles" },
  { href: "/locations", label: "Browse by Location" },
  { href: "/shops", label: "Rental Companies" },
  { href: "/how-it-works", label: "How It Works" },
];

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The one top bar shared by every (public) page — logo, primary nav, and sign-in/sign-up links. */
export function PublicHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();

  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const brandName = brand?.name || "RentLanka";
  const logoUrl = brand?.logo || null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-8 w-auto"
            fallbackClassName="size-8 shrink-0 rounded-lg bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white"
            iconClassName="size-4"
          />
          <span className="hidden sm:inline">{brandName}</span>
        </Link>

        {/* ── Desktop nav ──────────────────────────────────────────────── */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            asChild
            className="hidden gap-1.5 border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-violet-500/10 text-foreground hover:border-orange-500/40 hover:from-orange-500/15 hover:via-pink-500/15 hover:to-violet-500/15 sm:flex"
          >
            <Link href="/account/become-owner"><Store className="h-4 w-4 text-primary" /> Become a Vendor</Link>
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xs font-semibold text-white">
                    {getInitials(user?.name) || "U"}
                  </span>
                  <span className="max-w-[9rem] truncate text-sm font-medium">{user?.name ?? "My Account"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{user?.name ?? "My Account"}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> My Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="sm:hidden">
                  <Link href="/account/become-owner"><Store className="mr-2 h-4 w-4" /> Become a Vendor</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" asChild><Link href="/login">Sign in</Link></Button>
              <Button asChild className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}

          {/* ── Mobile menu ────────────────────────────────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {NAV_ITEMS.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/account/become-owner"><Store className="mr-2 h-4 w-4" /> Become a Vendor</Link></DropdownMenuItem>
              {!isAuthenticated && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/login">Sign in</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/register">Sign up</Link></DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
