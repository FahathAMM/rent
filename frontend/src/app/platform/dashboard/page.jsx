"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { platformDashboardService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet, CalendarCheck, Percent, Banknote, Building2, Car, Clock, Home,
} from "lucide-react";

function format(amount) {
  return amount == null ? "—" : `LKR ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value, sub, Icon, color }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function QueueCard({ label, count, href, Icon }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">{label}</p>
          </div>
          <p className="text-2xl font-bold">{count}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PlatformDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: () => platformDashboardService.getSummary().then((r) => r.data.data),
  });

  const gmv = data?.gmv ?? {};
  const bookings = data?.bookings ?? {};
  const commission = data?.commission ?? {};
  const payoutsDue = data?.payouts_due ?? {};
  const queues = data?.queues ?? {};

  const breadcrumbItems = [{ label: "Dashboard", icon: <Home className="size-4" /> }];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Platform Dashboard" description="GMV, bookings, commission, payouts due, and review queues across the marketplace." />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="GMV (paid bookings)"
            value={isLoading ? "—" : format(gmv.total)}
            sub={isLoading ? undefined : `${gmv.paid_booking_count ?? 0} paid bookings`}
            Icon={Wallet}
            color="text-indigo-600 bg-indigo-50"
          />
          <StatCard
            label="Total Bookings"
            value={isLoading ? "—" : (bookings.total ?? 0).toLocaleString()}
            sub={isLoading ? undefined : `${bookings.pending ?? 0} pending · ${bookings.active ?? 0} active`}
            Icon={CalendarCheck}
            color="text-sky-600 bg-sky-50"
          />
          <StatCard
            label="Commission Income"
            value={isLoading ? "—" : format(commission.commission_income)}
            sub={isLoading ? undefined : `${format(commission.platform_net)} net of gateway fees`}
            Icon={Percent}
            color="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            label="Payouts Due"
            value={isLoading ? "—" : format((payoutsDue.in_flight_payouts ?? 0) + (payoutsDue.unsettled_not_yet_built ?? 0))}
            sub={isLoading ? undefined : `${format(payoutsDue.in_flight_payouts)} in flight`}
            Icon={Banknote}
            color="text-amber-600 bg-amber-50"
          />
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Booking Pipeline</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Pending", bookings.pending],
              ["Confirmed", bookings.confirmed],
              ["Active", bookings.active],
              ["Completed", bookings.completed],
              ["Cancelled / Expired", bookings.cancelled_or_expired],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{isLoading ? "—" : (value ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Review Queues</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QueueCard label="Shop Verifications" count={isLoading ? "—" : queues.shop_verifications ?? 0} href="/platform/shops" Icon={Building2} />
            <QueueCard label="Listing Moderation" count={isLoading ? "—" : queues.listing_moderation ?? 0} href="/platform/listings" Icon={Car} />
            <QueueCard label="Payout Approvals" count={isLoading ? "—" : queues.payout_approvals ?? 0} href="/platform/payouts" Icon={Clock} />
          </div>
        </div>
      </PageWrapper>
    </div>
  );
}
