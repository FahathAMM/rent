"use client";

import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Heart, Search, Store, ArrowRight, Car, Users, Wallet } from "lucide-react";
import Link from "next/link";

export default function AccountDashboardPage() {
  const { customer } = useCustomerAuthStore();

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
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {customer?.name?.split(" ")[0]}</h1>
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
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">List your own vehicles</h2>
          <p className="text-sm text-muted-foreground">Turn your vehicles into income by registering a rental shop.</p>
        </div>
        <div className="group relative isolate overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/20 via-pink-500/20 to-transparent blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-gradient-to-br from-orange-500/15 to-transparent blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
                <Store className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">Register a Rental Shop</h3>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                List your vehicles, add staff, and start taking bookings once your shop is verified.
              </p>
              <Button asChild className="mt-5 w-fit bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                <Link href="/vendor/register">Get started <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
              </Button>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Car, title: "List your fleet", body: "Cars, vans, SUVs — with photos and your own prices." },
                { icon: CalendarCheck, title: "Take bookings", body: "Accept requests and manage your calendar online." },
                { icon: Users, title: "Add your staff", body: "Each person gets their own login and permissions." },
                { icon: Wallet, title: "Get paid", body: "Earnings are tracked and paid out to your bank." },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3 rounded-xl border bg-background/60 p-3.5 backdrop-blur-sm">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
