"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/components/public/LanguageSwitcher";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";
import {
  Menu, X, Home, CarFront, MapPin, Building2, Sparkles, ChevronRight, Store, LogIn, UserPlus,
  LayoutDashboard, CalendarRange, Heart, Star, UserRound, LogOut, BadgeDollarSign, MessageCircle,
} from "lucide-react";

const NAV = [
  { href: "/", key: "home", icon: Home },
  { href: "/rent", key: "rent", icon: CarFront },
  { href: "/buy", key: "buy", icon: BadgeDollarSign },
  { href: "/locations", key: "location", icon: MapPin },
  { href: "/shops", key: "shops", icon: Building2 },
  { href: "/how-it-works", key: "howItWorks", icon: Sparkles },
];

const ACCOUNT_LINKS = [
  { href: "/account/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/account/bookings", key: "bookings", icon: CalendarRange },
  { href: "/account/enquiries", key: "enquiries", icon: MessageCircle },
  { href: "/account/favorites", key: "favorites", icon: Heart },
  { href: "/account/reviews", key: "reviews", icon: Star },
  { href: "/account/profile", key: "profile", icon: UserRound },
];

const isActive = (pathname, href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/**
 * The public site's phone/tablet menu: a slide-in panel with the main nav,
 * the customer's account shortcuts (or sign-in), and the vendor entry point.
 */
export function MobileMenu({ brandName, logoUrl, tagline, customer, isAuthenticated, onLogout, vendor }) {
  const pathname = usePathname();
  const t = useTranslations("mobileMenu");
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on navigation, lock page scroll while open, Esc to close.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t("open")} aria-expanded={open}>
        <Menu className="h-4 w-4" />
      </Button>

      {/* Portalled to <body>: the header's backdrop-blur would otherwise become the
          containing block for `fixed`, squeezing the panel into the header strip. */}
      {mounted && createPortal(
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <div
          className={cn("absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className={cn(
            "absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* ── Brand header ── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 px-5 pb-5 pt-4 text-white">
            <div aria-hidden="true" className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" />
            <div className="relative flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <BrandLogo
                  logoUrl={logoUrl}
                  brandName={brandName}
                  imgClassName="h-8 w-auto drop-shadow"
                  fallbackClassName="size-8 rounded-lg bg-white/20 backdrop-blur-sm"
                  iconClassName="size-4"
                />
                {brandName}
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/15 p-1.5 hover:bg-white/25" aria-label={t("close")}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {isAuthenticated ? (
              <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-pink-600">
                  {getInitials(customer?.name) || "U"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{customer?.name ?? tHeader("myAccount")}</p>
                  <p className="truncate text-xs text-white/80">{customer?.email}</p>
                </div>
              </div>
            ) : (
              <div className="relative mt-4">
                <p className="text-sm text-white/85">{tagline}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/login" className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-semibold text-pink-600 shadow-sm">
                    <LogIn className="h-4 w-4" /> {tHeader("signIn")}
                  </Link>
                  <Link href="/register" className="flex items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2.5 text-sm font-semibold ring-1 ring-white/30">
                    <UserPlus className="h-4 w-4" /> {tHeader("signUp")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {/* ── Main nav ── */}
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("explore")}</p>
            <nav className="space-y-1">
              {NAV.map(({ href, key, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                      active ? "bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-violet-500/10" : "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm" : "bg-muted text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-medium", active && "text-primary")}>{tNav(key)}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{tNav(`hints.${key}`)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </Link>
                );
              })}
            </nav>

            {/* ── Customer account ── */}
            {isAuthenticated && (
              <>
                <p className="mt-5 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("myAccount")}</p>
                <div className="grid grid-cols-2 gap-2 px-1">
                  {ACCOUNT_LINKS.map(({ href, key, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        isActive(pathname, href) ? "border-primary/40 bg-primary/5 font-medium text-primary" : "bg-card hover:border-primary/30"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{t(`links.${key}`)}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* ── Vendor ── */}
            <div className="mt-5 px-1">
              {vendor.signedIn ? (
                <Link href={vendor.href} className="flex items-center gap-3 rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-violet-500/10 p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                    <Store className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{vendor.label}</span>
                    <span className="block text-xs text-muted-foreground">{t("openVendorPanel")}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : (
                <Link href={vendor.becomeHref ?? "/vendor/register"} className="relative block overflow-hidden rounded-2xl bg-zinc-900 p-4 text-white">
                  <div aria-hidden="true" className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 opacity-60 blur-2xl" />
                  <p className="relative flex items-center gap-1.5 text-sm font-semibold"><Store className="h-4 w-4" /> {t("ownBusiness")}</p>
                  <p className="relative mt-1 text-xs text-white/70">{t("ownBusinessBody")}</p>
                  <span className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900">
                    {tHeader("becomeVendor")} <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              )}
            </div>

            {/* ── Language ── */}
            <div className="mt-5 px-1">
              <LanguageToggle />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} {brandName}</span>
            {isAuthenticated && (
              <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="flex items-center gap-1.5 font-medium text-destructive">
                <LogOut className="h-3.5 w-3.5" /> {tHeader("logout")}
              </button>
            )}
          </div>
        </aside>
      </div>,
      document.body
      )}
    </>
  );
}
