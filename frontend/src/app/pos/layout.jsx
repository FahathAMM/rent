"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldOff, Loader2, Store } from "lucide-react";
import Link from "next/link";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function LiveClock() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="w-40" />;

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <p className="text-lg font-bold leading-tight text-foreground tabular-nums">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <div className="h-5 w-px bg-border" />
      <p className="text-sm font-medium leading-tight text-muted-foreground">
        {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

/**
 * Deliberately its own top-level route (not nested under (dashboard)) so it
 * skips the admin Sidebar/Header entirely — a cashier checking out a
 * customer needs the full screen for the product grid and cart, not a nav
 * rail. Re-does the same auth guard (dashboard)/layout.jsx does, since
 * moving out from under it means none of that is inherited for free.
 */
export default function PosLayout({ children }) {
  const { user, isAuthenticated, _hasHydrated, can } = useAuthStore();
  const router = useRouter();

  const pendingActivation = user?.company?.status === "initiate";

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login");
    else if (pendingActivation) router.replace("/account-pending");
  }, [isAuthenticated, pendingActivation, _hasHydrated, router]);

  if (!_hasHydrated || !isAuthenticated || pendingActivation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can("pos-new_sale-view")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 py-24 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to use the POS screen.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-100 to-slate-50">
      <ImpersonationBanner />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        </Button>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
            <Store className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight tracking-tight text-foreground">
              {user?.company?.name ?? "Point of Sale"}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">Point of Sale</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <LiveClock />
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
              {initials(user?.name)}
            </span>
            <span className="hidden text-sm font-medium text-foreground md:inline">{user?.name}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
