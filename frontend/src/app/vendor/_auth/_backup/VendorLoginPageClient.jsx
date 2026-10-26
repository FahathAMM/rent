"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { visitService } from "@/services/visitService";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { VendorLoginPanel } from "./VendorLoginPanel";
import { VendorRegisterPanel } from "./VendorRegisterPanel";
import { cn } from "@/lib/utils";

/**
 * Vendor/owner/staff sign-in shell — a separate account/guard from the
 * customer one at app/(auth)/login/LoginPageClient.jsx. Kept as its own
 * copy under app/vendor so the two identities' auth UI never has to
 * reach into each other's folder.
 */
export default function VendorLoginPageClient({ initialBrand, initialView = "login" }) {
  const [view, setView] = useState(initialView);
  const [direction, setDirection] = useState("forward");

  useEffect(() => {
    visitService.track("site_visit");
    // Only log once per page load, not on every login/register view switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = (next) => {
    setDirection(next === "register" ? "forward" : "backward");
    setView(next);
  };

  // Server-fetched on the login page itself (see page.jsx) so the logo/name/
  // tagline are already in the initial HTML — this query then just keeps
  // them fresh instead of being the thing that first paints them. `data`
  // may come back null if that server fetch failed, so `?? {}` here rather
  // than a destructuring default, which only catches undefined.
  const { data } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
    initialData: initialBrand,
  });
  const brand = data ?? {};
  const brandName = brand.name || "RentLanka";
  const tagline = brand.tagline || "Rent any vehicle, anywhere in Sri Lanka.";
  const logoUrl = brand.login_logo || brand.logo || null;
  const eyebrow = brand.login_eyebrow || "Cars, vans and more from trusted local owners";
  const headingText = (brand.login_heading || "Rent any vehicle, anywhere.").replace(/\.$/, "");
  const headingWords = headingText.split(" ");
  const headingHighlight = headingWords.pop();
  const headingPrefix = headingWords.join(" ");
  const description = brand.login_description || `${tagline} Browse vehicles from verified owners and shops, book in minutes, and pick up right where you left off.`;

  return (
    <div className="bg-background relative isolate h-svh w-full overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-grain" />
      </div>

      <div className="relative flex h-full flex-col px-5 py-4 sm:px-12 sm:py-6 lg:px-14 lg:py-8">
        <header className="flex items-center gap-2.5 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-8 w-auto object-contain"
            fallbackClassName="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
            iconClassName="size-4"
          />
          <span className="text-sm font-semibold tracking-tight">{brandName}</span>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 [align-items:safe_center] py-2">
          <div
            className={cn(
              "grid w-full grid-cols-1 items-center gap-10 transition-[grid-template-columns] duration-300 lg:gap-20",
              view === "register" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]"
            )}
          >
            {/* ── Hero copy — hidden below lg so mobile shows only the card ── */}
            <div className="hidden lg:flex max-w-xl flex-col gap-5 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="border-border/60 bg-background/80 text-foreground/70 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium tracking-tight backdrop-blur-sm">
                <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
                <span>{eyebrow}</span>
              </div>
              <h1 className="text-foreground text-5xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance xl:text-6xl">
                {headingPrefix} <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">{headingHighlight}</span>.
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty">
                {description}
              </p>
            </div>

            {/* ── Sign-in / create-vendor card — slides between the two ── */}
            <div
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-2xl border bg-card shadow-sm p-5 sm:p-6 animate-login-card transition-[max-width] duration-300",
                view === "register" ? "max-w-[500px]" : "max-w-[400px]"
              )}
            >
              <div
                key={view}
                className={cn(
                  "animate-in fade-in duration-300",
                  direction === "forward" ? "slide-in-from-right-8" : "slide-in-from-left-8"
                )}
              >
                {view === "login" ? (
                  <VendorLoginPanel brandName={brandName} logoUrl={logoUrl} onSwitchToRegister={() => switchTo("register")} />
                ) : (
                  <VendorRegisterPanel brandName={brandName} logoUrl={logoUrl} onSwitchToLogin={() => switchTo("login")} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
