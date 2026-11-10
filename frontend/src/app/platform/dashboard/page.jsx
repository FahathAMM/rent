"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { platformService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet, CalendarCheck, Building2, Car, Home,
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
    queryFn: () => platformService.dashboard.getSummary().then((r) => r.data.data),
  });

  const gmv = data?.gmv ?? {};
  const bookings = data?.bookings ?? {};
  const queues = data?.queues ?? {};
  const sales = data?.sales ?? {};

  const breadcrumbItems = [{ label: "Dashboard", icon: <Home className="size-4" /> }];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Platform Dashboard" description="Bookings, vehicle sales and review queues across the marketplace." />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="GMV (booked rental value)"
            value={isLoading ? "—" : format(gmv.total)}
            sub={isLoading ? undefined : `${gmv.paid_booking_count ?? 0} fully paid to shops`}
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Vehicle Sales</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["For sale now", sales.for_sale ?? 0],
              ["Open enquiries", sales.open_enquiries ?? 0],
              ["Sold", sales.sold ?? 0],
              ["Value recorded by shops", format(sales.sold_value ?? 0)],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Review Queues</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QueueCard label="Shop Verifications" count={isLoading ? "—" : queues.shop_verifications ?? 0} href="/platform/shops" Icon={Building2} />
            <QueueCard label="Listing Moderation" count={isLoading ? "—" : queues.listing_moderation ?? 0} href="/platform/listings" Icon={Car} />
          </div>
        </div>
      </PageWrapper>
    </div>
  );
}
