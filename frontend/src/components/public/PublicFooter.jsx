"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { BrandLogo } from "@/components/auth/BrandLogo";

export function PublicFooter() {
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const brandName = brand?.name || "LankaLane";
  const logoUrl = brand?.logo || null;
  const tagline = brand?.tagline || "Rent any vehicle, anywhere in Sri Lanka.";

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BrandLogo
              logoUrl={logoUrl}
              brandName={brandName}
              imgClassName="h-7 w-auto"
              fallbackClassName="size-7 shrink-0 rounded-lg bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white"
              iconClassName="size-3.5"
            />
            {brandName}
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{tagline}</p>
        </div>

        <div>
          <p className="text-sm font-semibold">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">Home</Link></li>
            <li><Link href="/browse" className="hover:text-foreground">Browse vehicles</Link></li>
            <li><Link href="/locations" className="hover:text-foreground">Browse by location</Link></li>
            <li><Link href="/shops" className="hover:text-foreground">Rental companies</Link></li>
            <li><Link href="/how-it-works" className="hover:text-foreground">How it works</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">For owners</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/vendor/register" className="hover:text-foreground">List your vehicle</Link></li>
            <li><Link href="/vendor/register" className="hover:text-foreground">Register a rental business</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
            <li><Link href="/register" className="hover:text-foreground">Create an account</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {brandName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
