"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { usePublicAuth } from "@/components/public/PublicAuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Menu, User as UserIcon } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Browse Vehicles" },
  { href: "/locations", label: "Browse by Location" },
  { href: "/shops", label: "Rental Companies" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/account/become-owner", label: "Become a Vendor" },
];

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The one top bar shared by every (public) page — logo, primary nav, and the sign-in/sign-up popup trigger. */
export function PublicHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const { openAuth } = usePublicAuth();

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
          {isAuthenticated ? (
            <Button asChild>
              <Link href="/account">
                <UserIcon className="mr-2 h-4 w-4" /> {user?.name?.split(" ")[0] ?? "My Account"}
              </Link>
            </Button>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" onClick={() => openAuth("login")}>Sign in</Button>
              <Button className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90" onClick={() => openAuth("register")}>
                Sign up
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
              {!isAuthenticated && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openAuth("login")}>Sign in</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openAuth("register")}>Sign up</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
