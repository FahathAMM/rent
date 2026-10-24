"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { usePublicAuth } from "@/components/public/PublicAuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { Button } from "@/components/ui/button";
import { Car, User as UserIcon } from "lucide-react";

/** The one top bar shared by every (public) page — logo, primary nav, and the sign-in/sign-up popup trigger. */
export function PublicHeader() {
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
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-8 w-auto"
            fallbackClassName="size-8 shrink-0 rounded-lg bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white"
            iconClassName="size-4"
          />
          <span className="hidden sm:inline">{brandName}</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/search">Browse</Link>
          </Button>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/account/become-owner">List your vehicle</Link>
          </Button>

          {isAuthenticated ? (
            <Button asChild>
              <Link href="/account">
                <UserIcon className="mr-2 h-4 w-4" /> {user?.name?.split(" ")[0] ?? "My Account"}
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => openAuth("login")}>Sign in</Button>
              <Button className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90" onClick={() => openAuth("register")}>
                Sign up
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
