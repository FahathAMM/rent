"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { visitService } from "@/services/visitService";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { DevCredit } from "@/components/auth/DevCredit";
import { VendorLoginPanel } from "./VendorLoginPanel";
import { VendorRegisterPanel } from "./VendorRegisterPanel";
import { Car, CalendarCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Car, tile: "bg-blue-600", title: "List & manage vehicles", body: "Publish your fleet, set pricing and control availability." },
  { icon: CalendarCheck, tile: "bg-teal-600", title: "Accept bookings instantly", body: "Review requests, confirm trips and track handovers." },
  { icon: Wallet, tile: "bg-purple-600", title: "Get paid, reliably", body: "Track payouts, commissions and earnings in one place." },
];

/**
 * Vendor/owner/staff sign-in — the diagonally-clipped color band stays as
 * the backdrop, but content is now a left/right split: the form on the
 * left, the value-prop description on the right (the reverse of the
 * customer shell's text-left/form-right at app/(auth)/login). Fixed to
 * the viewport (no page scroll); each column scrolls internally if it
 * ever needs to.
 */
export default function VendorLoginPageClient({ initialBrand, initialView = "login" }) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    visitService.track("site_visit");
    // Only log once per page load, not on every login/register view switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-fetched on the login page itself (see page.jsx) so the logo/name
  // is already in the initial HTML — this query then just keeps it fresh.
  const { data } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
    initialData: initialBrand,
  });
  const brand = data ?? {};
  const brandName = brand.name || "LankaLane";
  const logoUrl = brand.login_logo || brand.logo || null;

  return (
    <div className="bg-background relative h-svh w-full overflow-hidden">
      {/* ── Diagonal color band — kept as the backdrop, confined to the left half so it never crosses into the description column ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-500"
        style={{ clipPath: "polygon(0 0, 50% 0, 25% 100%, 0 100%)" }}
      />

      <Link
        href="/"
        className="absolute left-6 top-6 z-20 flex items-center gap-2 text-white transition-opacity hover:opacity-80 animate-in fade-in slide-in-from-top-4 duration-700"
      >
        <BrandLogo
          logoUrl={logoUrl}
          brandName={brandName}
          imgClassName="h-6 w-auto object-contain brightness-0 invert"
          fallbackClassName="bg-white/15 flex size-8 shrink-0 items-center justify-center rounded-lg backdrop-blur-sm"
          iconClassName="size-4 text-white"
        />
        <span className="text-sm font-semibold tracking-tight">{brandName} for Vendors</span>
      </Link>

      <div className="relative z-10 grid h-full lg:grid-cols-2">
        {/* ── Left — the form ── */}
        <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-16">
          <div className="w-full max-w-sm">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500" />
              <div className="p-6">
                <div className="mb-4 grid grid-cols-2 rounded-full bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className={cn(
                      "rounded-full py-1.5 text-sm font-medium transition-colors",
                      view === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("register")}
                    className={cn(
                      "rounded-full py-1.5 text-sm font-medium transition-colors",
                      view === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Register
                  </button>
                </div>

                <div key={view} className="animate-in fade-in duration-300">
                  {view === "login" ? (
                    <VendorLoginPanel onSwitchToRegister={() => setView("register")} />
                  ) : (
                    <VendorRegisterPanel brandName={brandName} onSwitchToLogin={() => setView("login")} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right — the description, hidden below lg ── */}
        <div className="hidden h-full flex-col justify-center overflow-y-auto px-10 lg:flex">
          <div className="max-w-md animate-in fade-in slide-in-from-right-6 duration-700">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance">
              Run your rental business, your way.
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Everything you need to list vehicles, manage bookings and get paid — built for Sri Lankan vehicle owners and shops.
            </p>

            <div className="mt-10 space-y-6">
              {FEATURES.map(({ icon: Icon, tile, title, body }) => (
                <div key={title} className="flex gap-3.5">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-white", tile)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-muted-foreground text-sm">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-6 z-10">
        <DevCredit />
      </div>
    </div>
  );
}
