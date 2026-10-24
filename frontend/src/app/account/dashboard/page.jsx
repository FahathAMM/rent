"use client";

import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Heart, Search, UserPlus, Store, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AccountDashboardPage() {
  const { user, isVendor } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* ── Welcome hero ──────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-3" />
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.name?.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Find a vehicle, track your bookings, and manage your account.</p>
          </div>
          <Button asChild size="lg" className="shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
            <Link href="/browse"><Search className="mr-2 h-4 w-4" /> Browse vehicles</Link>
          </Button>
        </div>
      </div>

      {/* ── Quick links ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/account/bookings" className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">My Bookings</p>
              <p className="text-sm text-muted-foreground">Track requests, payments and trips</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link href="/account/favorites" className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
              <Heart className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Favorites</p>
              <p className="text-sm text-muted-foreground">Vehicles you&apos;ve saved for later</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      {/* ── Vendor / owner CTA ───────────────────────────────────────────── */}
      {isVendor() ? (
        <Card className="overflow-hidden rounded-2xl border shadow-sm">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">You have a vendor account</p>
              <p className="text-sm text-muted-foreground">Manage your vehicles, bookings and earnings from your vendor dashboard.</p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/vendor/dashboard">Go to vendor dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">List your own vehicles</h2>
            <p className="text-sm text-muted-foreground">Turn an idle vehicle into income — pick whichever fits how you want to operate.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="group relative isolate overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-orange-500/20 via-pink-500/20 to-transparent blur-2xl" />
              <span className="relative inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-700">For individuals</span>
              <div className="relative mt-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
                <UserPlus className="h-6 w-6" />
              </div>
              <h3 className="relative mt-4 font-semibold">Become a Vehicle Owner</h3>
              <p className="relative mt-1.5 text-sm text-muted-foreground">List your own car or bike individually and start earning.</p>
              <Button asChild className="relative mt-5 w-fit bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                <Link href="/account/become-owner">Get started <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
              </Button>
            </div>

            <div className="group relative isolate overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-500/20 via-pink-500/20 to-transparent blur-2xl" />
              <span className="relative inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700">For businesses</span>
              <div className="relative mt-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
                <Store className="h-6 w-6" />
              </div>
              <h3 className="relative mt-4 font-semibold">Register a Rental Shop</h3>
              <p className="relative mt-1.5 text-sm text-muted-foreground">Run a business with multiple vehicles and staff? Register your shop.</p>
              <Button asChild className="relative mt-5 w-fit bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                <Link href="/account/shops/new">Get started <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
