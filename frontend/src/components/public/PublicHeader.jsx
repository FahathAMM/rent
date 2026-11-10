"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { platformDetailService } from "@/services/platformDetailService";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useAuthStore } from "@/store/authStore";
import { useShopStore } from "@/store/shopStore";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { MobileMenu } from "@/components/public/MobileMenu";
import { LanguageSwitcher } from "@/components/public/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import { Store, LayoutDashboard, LogOut, LogIn } from "lucide-react";

// No "Home" item — the brand logo/name links to the home page.
const NAV_ITEMS = [
  { href: "/rent", key: "rent" },
  { href: "/buy", key: "buy" },
  { href: "/locations", key: "location" },
  { href: "/shops", key: "shops" },
  { href: "/how-it-works", key: "howItWorks" },
];

// Shared look for the signed-in chips (vendor panel link + customer menu) so both read the same.
const USER_CHIP =
  "h-10 shrink-0 items-center gap-2 rounded-full border border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-violet-500/10 pl-1 pr-3 shadow-sm transition-colors hover:border-orange-500/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const USER_AVATAR =
  "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white";
const USER_NAME = "max-w-[10rem] truncate text-sm font-medium";
const USER_SUB = "text-[11px] text-muted-foreground";

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The one top bar shared by every (public) page — logo, primary nav, and the customer sign-in link. */
export function PublicHeader() {
  const pathname = usePathname();
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { isAuthenticated, customer, logout } = useCustomerAuth();
  // Vendor sign-in is a separate account (the pos-auth store), so a vendor
  // browsing the public site gets a link back to their panel instead of
  // "Become a Vendor". Read only after mount — the store is persisted in
  // localStorage, so the server render can't know about it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Lift the bar with a shadow once the page scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const vendorUser = useAuthStore((s) => s.user);
  const vendorAuthenticated = useAuthStore((s) => s.isAuthenticated) && mounted;
  const shop = useShopStore((s) => s.shop);
  // Only a verified shop's vendor counts as signed in here — until then
  // there's no vendor panel to go back to, so the header stays as for any
  // visitor and "Become a Vendor" goes through the vendor login.
  const vendorSignedIn = vendorAuthenticated && shop?.is_verified === true && !shop?.is_suspended;
  const vendorHref = "/vendor/dashboard";
  const vendorLabel = shop?.shop_name ?? vendorUser?.name ?? t("vendorPanel");
  const showBecomeVendor = !vendorSignedIn;
  const becomeVendorHref = "/vendor/login";

  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const brandName = brand?.name || "LankaLane";
  const logoUrl = brand?.logo || null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl transition-shadow duration-300 supports-[backdrop-filter]:bg-background/65",
        scrolled ? "border-border/70 shadow-[0_4px_24px_-12px_rgb(0_0_0/0.18)]" : "border-border/70"
      )}
    >
      {/* Brand accent hairline */}
      <div aria-hidden className="h-0.5 w-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" />

      {/* Logo │ menu │ user — each section split by a short vertical divider. */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex shrink-0 items-center gap-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
            fallbackClassName="size-9 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-md shadow-pink-500/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
            iconClassName="size-4"
          />
          <span className="hidden bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:inline">
            {brandName}
          </span>
        </Link>
        <span aria-hidden className="hidden h-7 w-px bg-border lg:block" />
        </div>

        {/* ── Desktop nav ──────────────────────────────────────────────── */}
        <div className="hidden flex-1 items-center justify-center px-6 lg:flex">
        <nav className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all duration-200",
                  active
                    ? "bg-background font-semibold shadow-[0_2px_10px_-3px_rgb(236_72_153/0.35)] ring-1 ring-pink-500/25"
                    : "font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    active &&
                      "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent"
                  )}
                >
                  {tNav(item.key)}
                </span>
              </Link>
            );
          })}
        </nav>
        </div>

        <div className="flex items-center gap-2">
          <span aria-hidden className="mr-4 hidden h-7 w-px bg-border lg:block" />
          <LanguageSwitcher />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />

          {showBecomeVendor && (
            <Button
              variant="outline"
              asChild
              className="hidden h-10 gap-1.5 rounded-full border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-violet-500/10 text-foreground hover:border-orange-500/40 hover:from-orange-500/15 hover:via-pink-500/15 hover:to-violet-500/15 sm:flex"
            >
              <Link href={becomeVendorHref}><Store className="h-4 w-4 text-primary" /> {t("becomeVendor")}</Link>
            </Button>
          )}

          {vendorSignedIn && (
            <Link
              href={vendorHref}
              title={t("goToVendorPanel")}
              className={cn(USER_CHIP, "hidden sm:flex")}
            >
              <span className={USER_AVATAR}>
                <Store className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className={USER_NAME}>{vendorLabel}</span>
                <span className={USER_SUB}>{t("vendorPanel")}</span>
              </span>
            </Link>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(USER_CHIP, "flex")}
                >
                  <span className={cn(USER_AVATAR, "text-xs font-semibold")}>
                    {getInitials(customer?.name) || "U"}
                  </span>
                  <span className="flex min-w-0 flex-col text-left leading-tight">
                    <span className={USER_NAME}>{customer?.name ?? t("myAccount")}</span>
                    <span className={USER_SUB}>{t("myAccount")}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{customer?.name ?? t("myAccount")}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{customer?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> {t("myAccount")}</Link>
                </DropdownMenuItem>
                {showBecomeVendor && (
                  <DropdownMenuItem asChild className="sm:hidden">
                    <Link href={becomeVendorHref}><Store className="mr-2 h-4 w-4" /> {t("becomeVendor")}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              className="hidden h-10 gap-1.5 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-5 text-white shadow-md shadow-pink-500/25 transition-all hover:-translate-y-px hover:opacity-95 hover:shadow-lg hover:shadow-pink-500/30 sm:flex"
            >
              <Link href="/login"><LogIn className="h-4 w-4" /> {t("signIn")}</Link>
            </Button>
          )}

          <MobileMenu
            brandName={brandName}
            logoUrl={logoUrl}
            tagline={brand?.tagline || tCommon("defaultTagline")}
            customer={customer}
            isAuthenticated={isAuthenticated}
            onLogout={logout}
            vendor={{ signedIn: vendorSignedIn, href: vendorHref, label: vendorLabel, becomeHref: becomeVendorHref }}
          />
        </div>
      </div>
    </header>
  );
}
