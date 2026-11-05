"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, APP_TIMEZONE } from "@/lib/utils";
import {
  Car, CheckCircle2, Clock, CalendarCheck, Star, Gauge, Eye, Home, Plus,
  TrendingUp, ArrowRight, ArrowUpRight, ArrowDownLeft, BellRing, Wallet, AlertTriangle, Landmark,
} from "lucide-react";

const timeOf = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE });

function StatTile({ label, value, sub, icon: Icon, tone, href }) {
  const body = (
    <Card className="group relative h-full overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary/70" />
      <CardContent className="flex h-full items-center justify-between gap-4 p-5 pt-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-3xl font-bold leading-none tracking-tight">{value}</p>
          {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SectionCard({ title, icon: Icon, action, children, className }) {
  return (
    <Card className={`rounded-xl border bg-card shadow-sm ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>} {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const ViewAll = ({ href }) => (
  <Link href={href} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
    View all <ArrowRight className="h-3 w-3" />
  </Link>
);

function IncomeChart({ data, format }) {
  const max = Math.max(...data.map((d) => d.income), 1);
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-4">
      {data.map((d, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {format(d.income)}
          </span>
          <div
            className={`w-full max-w-12 rounded-t-md transition-all ${i === data.length - 1 ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/50"}`}
            style={{ height: `${Math.max(2, (d.income / max) * 100)}%` }}
            title={`${d.month}: ${format(d.income)} · ${d.bookings} booking${d.bookings !== 1 ? "s" : ""}`}
          />
          <span className="text-xs text-muted-foreground">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function Ring({ pct }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-primary transition-all"
        strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} />
    </svg>
  );
}

const BOOKING_SEGMENTS = [
  { key: "pending", label: "Pending", color: "bg-amber-400" },
  { key: "confirmed_upcoming", label: "Upcoming", color: "bg-sky-400" },
  { key: "active", label: "Active", color: "bg-blue-600" },
  { key: "completed", label: "Completed", color: "bg-emerald-500" },
  { key: "no_show", label: "No-show", color: "bg-rose-400" },
  { key: "rejected_cancelled_expired", label: "Cancelled / expired", color: "bg-slate-300" },
];

const LISTING_ROWS = [
  { key: "published", label: "Published", color: "bg-emerald-500" },
  { key: "pending_review", label: "In review", color: "bg-amber-400" },
  { key: "draft", label: "Draft", color: "bg-slate-400" },
  { key: "unpublished", label: "Unpublished", color: "bg-slate-300" },
  { key: "rejected", label: "Rejected", color: "bg-rose-400" },
];

function ScheduleRow({ item, kind }) {
  const Icon = kind === "pickup" ? ArrowUpRight : ArrowDownLeft;
  return (
    <Link href={`/vendor/bookings/${item.reference}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kind === "pickup" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.vehicle}</p>
        <p className="truncate text-xs text-muted-foreground">{item.customer} · {item.reference}</p>
      </div>
      <span className={`shrink-0 text-xs font-medium ${item.overdue ? "text-destructive" : "text-muted-foreground"}`}>
        {item.overdue ? "Overdue" : timeOf(item.at)}
      </span>
    </Link>
  );
}

const Empty = ({ children }) => <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;

export default function VendorDashboardPage() {
  const { user } = useAuthStore();
  const { format } = useCurrencyFormat();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: () => vendorService.dashboard.getSummary().then((r) => r.data.data),
  });

  const listings = data?.listings ?? {};
  const bookings = data?.bookings ?? {};
  const revenue = data?.revenue ?? {};
  const utilisation = data?.vehicle_utilisation ?? {};
  const performance = data?.listing_performance ?? [];
  const reviews = data?.reviews ?? {};
  const today = data?.today ?? { pickups: [], returns: [] };
  const attention = data?.attention ?? {};
  const trend = data?.income_trend ?? [];
  const recent = data?.recent_bookings ?? [];

  const v = (x) => (isLoading ? "—" : x ?? 0);
  const bookingTotal = BOOKING_SEGMENTS.reduce((s, seg) => s + (bookings[seg.key] ?? 0), 0);
  const receivedPct = revenue.rental_income > 0 ? Math.round((revenue.received / revenue.rental_income) * 100) : 0;
  const thisMonth = trend.at(-1)?.income ?? 0;
  const lastMonth = trend.at(-2)?.income ?? 0;
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const maxBookings = Math.max(...performance.map((p) => p.booking_count), 1);

  const breadcrumbItems = [{ label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> }];

  return (
    <HomePageWrapper className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="relative isolate overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-white p-4 text-slate-900 shadow-sm dark:border-blue-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950 dark:text-white sm:p-5">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 h-64 w-64 rounded-full bg-blue-300/30 blur-3xl dark:bg-blue-500/15" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:border-white/20 dark:bg-white/10 dark:text-blue-100">
                {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: APP_TIMEZONE })}
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Vendor workspace</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Good to see you, {user?.name?.split(" ")[0]}</h1>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600 dark:text-slate-300">Your fleet, bookings, and earnings in one place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-lg border-blue-200 bg-white/80 text-slate-700 hover:bg-white dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/15"><Link href="/vendor/bookings"><CalendarCheck className="mr-1.5 h-4 w-4" /> Bookings</Link></Button>
              <Button asChild size="sm" className="rounded-lg shadow-sm"><Link href="/vendor/vehicles/new"><Plus className="mr-1.5 h-4 w-4" /> Add vehicle</Link></Button>
            </div>
          </div>
        </div>

        {bookings.pending > 0 && (
          <Link href="/vendor/bookings" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <BellRing className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">{bookings.pending} booking request{bookings.pending !== 1 ? "s" : ""}</span> waiting for your answer. Reply quickly so they don&apos;t expire.
            </p>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        {!isLoading && ((attention.pending_transfers ?? 0) > 0 || (attention.overdue_returns ?? 0) > 0) && (
          <SectionCard title="Needs attention" icon={AlertTriangle}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(attention.pending_transfers ?? 0) > 0 && (
                <Link href="/vendor/bookings" className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <Landmark className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <span className="min-w-0 flex-1 text-sm"><strong>{attention.pending_transfers}</strong> bank transfer{attention.pending_transfers !== 1 ? "s" : ""} to verify</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {(attention.overdue_returns ?? 0) > 0 && (
                <Link href="/vendor/bookings" className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  <span className="min-w-0 flex-1 text-sm"><strong>{attention.overdue_returns}</strong> active rental{attention.overdue_returns !== 1 ? "s" : ""} past return time</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
            </div>
          </SectionCard>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total Listings" value={v(listings.total)} sub={isLoading ? undefined : `${listings.available_now ?? 0} available now`} icon={Car} tone="bg-blue-100 text-blue-700" href="/vendor/vehicles" />
          <StatTile label="Pending Requests" value={v(bookings.pending)} sub={isLoading ? undefined : "waiting for your answer"} icon={Clock} tone="bg-amber-100 text-amber-700" href="/vendor/bookings" />
          <StatTile label="Active Rentals" value={v(bookings.active)} sub={isLoading ? undefined : `${bookings.confirmed_upcoming ?? 0} confirmed upcoming`} icon={CalendarCheck} tone="bg-sky-100 text-sky-700" href="/vendor/bookings" />
          <StatTile label="Completed Rentals" value={v(bookings.completed)} sub={isLoading ? undefined : `${bookings.no_show ?? 0} no-show`} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" href="/vendor/bookings" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <SectionCard
            title="Rental Income"
            icon={TrendingUp}
            className="lg:col-span-2"
            action={change !== null && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {change >= 0 ? "+" : ""}{change}% vs last month
              </span>
            )}
          >
            <div className="mb-4">
              <p className="text-2xl font-bold">{isLoading ? "—" : format(thisMonth)}</p>
              <p className="text-xs text-muted-foreground">this month, by pickup date</p>
            </div>
            {isLoading ? <Empty>Loading...</Empty> : <IncomeChart data={trend} format={format} />}
          </SectionCard>

          <SectionCard title="Money" icon={Wallet} action={<ViewAll href="/vendor/finance/earnings" />}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Total rental income</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : format(revenue.rental_income)}</p>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>{receivedPct}% received</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/50">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${receivedPct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/40">
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Received</p>
                  <p className="mt-0.5 truncate text-sm font-bold">{isLoading ? "—" : format(revenue.received)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Still to receive</p>
                  <p className="mt-0.5 truncate text-sm font-bold">{isLoading ? "—" : format(revenue.still_due)}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Confirmed, active and completed bookings. Collect at pickup or by transfer.</p>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <SectionCard title="Today" icon={CalendarCheck}>
            {isLoading ? <Empty>Loading...</Empty> : today.pickups.length + today.returns.length === 0 ? (
              <Empty>No pickups or returns today.</Empty>
            ) : (
              <div className="space-y-3">
                {today.pickups.length > 0 && (
                  <div>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pickups ({today.pickups.length})</p>
                    {today.pickups.map((b) => <ScheduleRow key={b.reference} item={b} kind="pickup" />)}
                  </div>
                )}
                {today.returns.length > 0 && (
                  <div>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Returns ({today.returns.length})</p>
                    {today.returns.map((b) => <ScheduleRow key={b.reference} item={b} kind="return" />)}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Bookings Overview" icon={CheckCircle2}>
            {isLoading ? <Empty>Loading...</Empty> : bookingTotal === 0 ? <Empty>No bookings yet.</Empty> : (
              <>
                <p className="text-2xl font-bold">{bookingTotal}</p>
                <p className="mb-3 text-xs text-muted-foreground">bookings in total</p>
                <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {BOOKING_SEGMENTS.map((seg) => bookings[seg.key] > 0 && (
                    <div key={seg.key} className={seg.color} style={{ width: `${(bookings[seg.key] / bookingTotal) * 100}%` }} title={`${seg.label}: ${bookings[seg.key]}`} />
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {BOOKING_SEGMENTS.map((seg) => (
                    <li key={seg.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />{seg.label}</span>
                      <span className="font-medium">{bookings[seg.key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>

          <SectionCard title="Fleet" icon={Gauge} action={<ViewAll href="/vendor/vehicles" />}>
            {isLoading ? <Empty>Loading...</Empty> : (
              <>
                <div className="mb-4 flex items-center gap-4">
                  <div className="relative">
                    <Ring pct={utilisation.utilisation_pct ?? 0} />
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{Math.round(utilisation.utilisation_pct ?? 0)}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Utilisation, last 30 days</p>
                    <p className="text-xs text-muted-foreground">{utilisation.booked_days ?? 0} booked of {utilisation.available_days ?? 0} available vehicle-days</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {LISTING_ROWS.map((row) => (
                    <li key={row.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${row.color}`} />{row.label}</span>
                      <span className="font-medium">{listings[row.key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <SectionCard title="Recent Bookings" icon={CalendarCheck} className="lg:col-span-2" action={<ViewAll href="/vendor/bookings" />}>
            {isLoading ? <Empty>Loading...</Empty> : recent.length === 0 ? <Empty>No bookings yet.</Empty> : (
              <ul className="divide-y">
                {recent.map((b) => (
                  <li key={b.reference}>
                    <Link href={`/vendor/bookings/${b.reference}`} className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-3 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.vehicle}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.customer} · {b.reference}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(b.pickup_at, { year: undefined })} – {formatDate(b.return_at, { year: undefined })}</span>
                      <span className="w-28 shrink-0 text-sm font-semibold sm:text-right">{format(b.total)}</span>
                      <StatusBadge status={b.status} className="w-fit shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="space-y-4 lg:space-y-5">
            <SectionCard title="Customer Reviews" icon={Star}>
              {isLoading ? <Empty>Loading...</Empty> : reviews.count > 0 ? (
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
              ) : <p className="text-sm text-muted-foreground">No published reviews yet.</p>}
            </SectionCard>

            <SectionCard title="Top Listings" icon={Eye}>
              {isLoading ? <Empty>Loading...</Empty> : performance.length === 0 ? <Empty>No bookings yet.</Empty> : (
                <ul className="space-y-3">
                  {performance.map((p) => (
                    <li key={p.id}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{p.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.booking_count} bookings</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(p.booking_count / maxBookings) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{p.view_count} views · {p.inquiry_count} inquiries · {p.conversion_pct}% conversion</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </HomePageWrapper>
  );
}
