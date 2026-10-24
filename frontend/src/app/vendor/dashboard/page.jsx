"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { vendorDashboardService } from "@/services/vendorDashboardService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Car, CheckCircle2, Clock, CalendarCheck, Wallet, Percent, Banknote, Star,
  Gauge, Eye, Home,
} from "lucide-react";

function StatTile({ label, value, sub, icon: Icon, tone }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendorDashboardPage() {
  const { user } = useAuthStore();
  const { format } = useCurrencyFormat();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: () => vendorDashboardService.getSummary().then((r) => r.data.data),
  });

  const listings = data?.listings ?? {};
  const bookings = data?.bookings ?? {};
  const revenue = data?.revenue ?? {};
  const payouts = data?.payouts ?? {};
  const utilisation = data?.vehicle_utilisation ?? {};
  const performance = data?.listing_performance ?? [];
  const reviews = data?.reviews ?? {};

  const breadcrumbItems = [{ label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> }];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your vehicles.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total Listings" value={isLoading ? "—" : listings.total ?? 0} sub={isLoading ? undefined : `${listings.available_now ?? 0} available now`} icon={Car} tone="bg-blue-100 text-blue-700" />
          <StatTile label="Pending Requests" value={isLoading ? "—" : bookings.pending ?? 0} sub={isLoading ? undefined : `${bookings.awaiting_payment ?? 0} awaiting payment`} icon={Clock} tone="bg-amber-100 text-amber-700" />
          <StatTile label="Active Rentals" value={isLoading ? "—" : bookings.active ?? 0} sub={isLoading ? undefined : `${bookings.confirmed_upcoming ?? 0} confirmed upcoming`} icon={CalendarCheck} tone="bg-sky-100 text-sky-700" />
          <StatTile label="Completed Rentals" value={isLoading ? "—" : bookings.completed ?? 0} sub={isLoading ? undefined : `${bookings.no_show ?? 0} no-show`} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Rental Revenue" value={isLoading ? "—" : format(revenue.rental_revenue)} icon={Wallet} tone="bg-indigo-100 text-indigo-700" />
          <StatTile label="Platform Commission" value={isLoading ? "—" : format(revenue.platform_commission)} icon={Percent} tone="bg-rose-100 text-rose-700" />
          <StatTile
            label="Payable Balance"
            value={isLoading ? "—" : format(revenue.owner_payable_balance)}
            sub={isLoading ? undefined : "Unsettled — awaiting next payout cycle"}
            icon={Banknote}
            tone="bg-amber-100 text-amber-700"
          />
          <StatTile
            label="Paid Out"
            value={isLoading ? "—" : format(payouts.paid?.amount)}
            sub={isLoading ? undefined : `${payouts.paid?.count ?? 0} payout(s) · ${payouts.pending?.count ?? 0} pending`}
            icon={Banknote}
            tone="bg-emerald-100 text-emerald-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" /> Fleet Utilisation (30 days)</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, utilisation.utilisation_pct ?? 0)}%` }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {utilisation.utilisation_pct ?? 0}% utilised — {utilisation.booked_days ?? 0} booked of {utilisation.available_days ?? 0} available vehicle-days
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Customer Reviews</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : reviews.count > 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold">{reviews.avg_rating}</p>
                  <div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < Math.round(reviews.avg_rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{reviews.count} published review{reviews.count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No published reviews yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> Top Listings by Bookings</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="divide-y">
                {performance.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium">{v.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.view_count} views · {v.inquiry_count} inquiries · {v.booking_count} bookings · {v.conversion_pct}% conversion
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Manage your fleet from <Link href="/vendor/vehicles" className="text-primary font-medium hover:underline">Vehicles</Link>,
              respond to requests from <Link href="/vendor/bookings" className="text-primary font-medium hover:underline">Bookings</Link>,
              and track settlements in <Link href="/vendor/finance/payouts" className="text-primary font-medium hover:underline">Payouts</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </HomePageWrapper>
  );
}
