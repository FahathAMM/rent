"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, formatDateTime } from "@/lib/utils";
import {
  Wallet, CalendarCheck, Building2, Car, Home, Users, Star, Scale, Flag, CreditCard, Megaphone,
  TrendingUp, TrendingDown, Minus, ArrowUpRight, CheckCircle2, BadgeCheck, Store, Tag, MessageSquare,
  HandCoins, Loader2, Table2, BarChart3, Sparkles, ChevronRight, Inbox,
} from "lucide-react";

function lkr(amount, compact = false) {
  if (amount == null) return "—";
  const n = Number(amount);
  if (compact && n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (compact && n >= 1_000) return `LKR ${(n / 1_000).toFixed(0)}k`;
  return `LKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const shortDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** % change vs the previous 30 days; null when there's nothing to compare against. */
function delta(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Booking pipeline: validated categorical palette (dataviz reference slots 1–5), light + dark steps.
const PIPELINE = [
  { key: "pending", label: "Pending", cls: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  { key: "confirmed", label: "Confirmed", cls: "bg-[#eb6834] dark:bg-[#d95926]" },
  { key: "active", label: "Active", cls: "bg-[#1baf7a] dark:bg-[#199e70]" },
  { key: "completed", label: "Completed", cls: "bg-[#eda100] dark:bg-[#c98500]" },
  { key: "cancelled_or_expired", label: "Cancelled / expired", cls: "bg-[#e87ba4] dark:bg-[#d55181]" },
];

const TREND_METRICS = [
  { key: "bookings", label: "Bookings", format: (v) => v.toLocaleString() },
  { key: "value", label: "Booked value", format: (v) => lkr(v, true) },
  { key: "customers", label: "New customers", format: (v) => v.toLocaleString() },
];

const QUEUES = [
  { key: "shop_verifications", label: "Shop verifications", href: "/platform/shops", icon: Building2 },
  { key: "listing_moderation", label: "Listing moderation", href: "/platform/listings", icon: Car },
  { key: "reviews", label: "Reviews to moderate", href: "/platform/reviews", icon: Star },
  { key: "disputes", label: "Open disputes", href: "/platform/disputes", icon: Scale },
  { key: "abuse_reports", label: "Abuse reports", href: "/platform/abuse-reports", icon: Flag },
  { key: "subscription_payments", label: "Subscription payments", href: "/platform/subscriptions", icon: CreditCard },
  { key: "promotion_requests", label: "Promotion requests", href: "/platform/promotions", icon: Megaphone },
];

/* ─── Small pieces ────────────────────────────────────────────────────── */

function Delta({ value }) {
  if (value == null) return <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600"><Sparkles className="h-3 w-3" />new</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
      value > 0 ? "bg-emerald-500/10 text-emerald-600" : value < 0 ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
    )}>
      <Icon className="h-3 w-3" />{value > 0 ? "+" : ""}{value}%
    </span>
  );
}

/** Tiny single-series trend line, no axes — the tile's title names it. */
function Sparkline({ values, className }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const w = 100, h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden="true">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiTile({ icon: Icon, label, value, sub, change, spark, tone, loading }) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("flex size-10 items-center justify-center rounded-xl", tone)}><Icon className="h-5 w-5" /></span>
          {!loading && change !== undefined && <Delta value={change} />}
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight">{loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" /> : value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && !loading && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        {spark && <Sparkline values={spark} className={cn("mt-2", tone.split(" ").find((c) => c.startsWith("text-")))} />}
      </CardContent>
    </Card>
  );
}

/* ─── Trend chart ─────────────────────────────────────────────────────── */

function TrendChart({ days, loading }) {
  const [metric, setMetric] = useState(TREND_METRICS[0]);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const values = days.map((d) => d[metric.key]);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const active = hover != null ? days[hover] : null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-base">{metric.label} · last 30 days</CardTitle>
          <CardDescription>
            {active
              ? <><span className="font-semibold text-foreground">{metric.format(active[metric.key])}</span> on {shortDate(active.date)}</>
              : <>Total <span className="font-semibold text-foreground">{metric.format(total)}</span></>}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            {TREND_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", metric.key === m.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAsTable((t) => !t)}
            className="inline-flex size-7 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"
            aria-label={asTable ? "Show chart" : "Show table"}
            title={asTable ? "Show chart" : "Show table"}
          >
            {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : asTable ? (
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr><th className="px-3 py-1.5 text-left font-medium">Date</th>{TREND_METRICS.map((m) => <th key={m.key} className="px-3 py-1.5 text-right font-medium">{m.label}</th>)}</tr>
              </thead>
              <tbody>
                {[...days].reverse().map((d) => (
                  <tr key={d.date} className="border-t">
                    <td className="px-3 py-1.5">{shortDate(d.date)}</td>
                    {TREND_METRICS.map((m) => <td key={m.key} className="px-3 py-1.5 text-right tabular-nums">{m.format(d[m.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative">
            {/* Recessive grid: max and mid lines */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48">
              {[0, 0.5].map((f) => (
                <div key={f} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${f * 100}%` }}>
                  <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground">{metric.format(Math.round(max * (1 - f)))}</span>
                </div>
              ))}
            </div>
            <div className="flex h-48 items-end gap-[2px] border-b pr-12" onMouseLeave={() => setHover(null)}>
              {days.map((d, i) => {
                const v = d[metric.key];
                return (
                  <div
                    key={d.date}
                    className="group relative flex h-full flex-1 items-end"
                    onMouseEnter={() => setHover(i)}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-[4px] transition-colors",
                        v > 0 ? "bg-[#2a78d6] dark:bg-[#3987e5]" : "bg-muted",
                        hover != null && hover !== i && "opacity-40"
                      )}
                      style={{ height: v > 0 ? `${Math.max((v / max) * 100, 3)}%` : "2px" }}
                    />
                    {hover === i && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                        <p className="font-semibold">{shortDate(d.date)}</p>
                        {TREND_METRICS.map((m) => (
                          <p key={m.key} className={cn("flex justify-between gap-3", m.key === metric.key ? "text-foreground" : "text-muted-foreground")}>
                            <span>{m.label}</span><span className="font-medium tabular-nums">{m.format(d[m.key])}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between pr-12 text-[10px] text-muted-foreground">
              <span>{days[0] && shortDate(days[0].date)}</span>
              <span>{days[14] && shortDate(days[14].date)}</span>
              <span>Today</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function PlatformDashboardPage() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: () => platformService.dashboard.getSummary().then((r) => r.data.data),
  });

  const gmv = data?.gmv ?? {};
  const bookings = data?.bookings ?? {};
  const queues = data?.queues ?? {};
  const sales = data?.sales ?? {};
  const community = data?.community ?? {};
  const trend = data?.trend ?? { days: [], current: {}, previous: {} };
  const topShops = data?.top_shops ?? [];
  const recent = data?.recent_bookings ?? [];

  const days = trend.days ?? [];
  const cur = trend.current ?? {};
  const prev = trend.previous ?? {};
  const waiting = QUEUES.reduce((sum, q) => sum + (queues[q.key] ?? 0), 0);
  const pipelineTotal = PIPELINE.reduce((sum, p) => sum + (bookings[p.key] ?? 0), 0);
  const topMax = Math.max(...topShops.map((s) => s.bookings), 1);
  const verifiedPct = community.shops ? Math.round(((community.verified_shops ?? 0) / community.shops) * 100) : 0;

  const breadcrumbItems = [{ label: "Dashboard", icon: <Home className="size-4" /> }];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-8">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-sm sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.25),transparent_40%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-white/80">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{greeting()}, {admin?.name?.split(" ")[0] ?? "there"} 👋</h1>
              <p className="mt-1 text-sm text-white/80">Here&apos;s what&apos;s happening across the marketplace.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                <p className="text-xs text-white/75">Waiting for review</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : waiting}</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                <p className="text-xs text-white/75">GMV (all time)</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : lkr(gmv.total, true)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPIs (last 30 days) ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            icon={Wallet} label="Booked value · 30 days" value={lkr(cur.value)} loading={isLoading}
            change={delta(cur.value ?? 0, prev.value ?? 0)} sub={`${gmv.paid_booking_count ?? 0} bookings fully paid to shops`}
            spark={days.map((d) => d.value)} tone="bg-indigo-500/10 text-indigo-600"
          />
          <KpiTile
            icon={CalendarCheck} label="Bookings · 30 days" value={(cur.bookings ?? 0).toLocaleString()} loading={isLoading}
            change={delta(cur.bookings ?? 0, prev.bookings ?? 0)} sub={`${(bookings.total ?? 0).toLocaleString()} all time`}
            spark={days.map((d) => d.bookings)} tone="bg-sky-500/10 text-sky-600"
          />
          <KpiTile
            icon={Users} label="New customers · 30 days" value={(cur.customers ?? 0).toLocaleString()} loading={isLoading}
            change={delta(cur.customers ?? 0, prev.customers ?? 0)} sub={`${(community.customers ?? 0).toLocaleString()} customers in total`}
            spark={days.map((d) => d.customers)} tone="bg-emerald-500/10 text-emerald-600"
          />
          <KpiTile
            icon={Car} label="Live vehicles" value={(community.published_vehicles ?? 0).toLocaleString()} loading={isLoading}
            sub={`across ${(community.verified_shops ?? 0).toLocaleString()} verified shops`} tone="bg-amber-500/10 text-amber-600"
          />
        </div>

        {/* ── Trend + needs attention ────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <TrendChart days={days} loading={isLoading} />

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                Needs attention
                {!isLoading && waiting > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{waiting} waiting</span>}
              </CardTitle>
              <CardDescription>Review queues across the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {QUEUES.map(({ key, label, href, icon: Icon }) => {
                const n = queues[key] ?? 0;
                return (
                  <Link key={key} href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", n ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={cn("flex-1 text-sm", !n && "text-muted-foreground")}>{label}</span>
                    {isLoading ? (
                      <span className="h-5 w-6 animate-pulse rounded bg-muted" />
                    ) : n ? (
                      <span className="min-w-6 rounded-full bg-amber-500 px-2 py-0.5 text-center text-xs font-bold text-white">{n}</span>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="all clear" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ── Pipeline + community ───────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Booking pipeline</CardTitle>
              <CardDescription>{(bookings.total ?? 0).toLocaleString()} bookings all time, by where they are now</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
                {pipelineTotal > 0 && PIPELINE.map((p) => {
                  const n = bookings[p.key] ?? 0;
                  return n > 0 && <div key={p.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.cls)} style={{ width: `${(n / pipelineTotal) * 100}%` }} title={`${p.label}: ${n}`} />;
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PIPELINE.map((p) => {
                  const n = bookings[p.key] ?? 0;
                  return (
                    <div key={p.key} className="rounded-xl border p-3">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-2.5 shrink-0 rounded-full", p.cls)} />{p.label}</p>
                      <p className="mt-1 text-xl font-bold">{isLoading ? "—" : n.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">{pipelineTotal ? Math.round((n / pipelineTotal) * 100) : 0}%</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Community</CardTitle>
              <CardDescription>Shops and customers on the marketplace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Store className="h-4 w-4 text-violet-600" /> Shops</span>
                  <span className="font-semibold">{(community.shops ?? 0).toLocaleString()}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${verifiedPct}%` }} />
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <BadgeCheck className="h-3 w-3 text-violet-600" />{community.verified_shops ?? 0} verified ({verifiedPct}%) · +{community.new_shops_30d ?? 0} this month
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <p className="mt-1.5 text-lg font-bold">{(community.customers ?? 0).toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Customers · +{community.new_customers_30d ?? 0} this month</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <Car className="h-4 w-4 text-amber-600" />
                  <p className="mt-1.5 text-lg font-bold">{(community.published_vehicles ?? 0).toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Vehicles live</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Top shops + recent bookings ────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top shops</CardTitle>
              <CardDescription>Most bookings in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topShops.map((s, i) => (
                <Link key={s.id} href={`/platform/shops/${s.id}`} className="group block">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-xs font-bold text-muted-foreground">{i + 1}</span>
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt="" className="size-8 rounded-lg border object-cover" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 text-xs font-bold text-white">{s.name?.charAt(0)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium group-hover:text-primary">{s.name}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(s.bookings / topMax) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{s.bookings}</span>
                  </div>
                </Link>
              ))}
              {!isLoading && !topShops.length && <EmptyNote icon={Store}>No bookings in the last 30 days.</EmptyNote>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Recent bookings</CardTitle>
                <CardDescription>The latest across all shops</CardDescription>
              </div>
              <Link href="/platform/bookings" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowUpRight className="h-3 w-3" /></Link>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {recent.map((b) => (
                <Link key={b.reference} href={`/platform/bookings/${b.reference}`} className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Car className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.vehicle ?? "Vehicle"} <span className="font-mono text-xs text-muted-foreground">· {b.reference}</span></p>
                      <p className="truncate text-xs text-muted-foreground">{b.customer ?? "—"} → {b.shop ?? "—"} · {formatDateTime(b.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.total != null && <span className="text-sm font-semibold tabular-nums">{lkr(b.total)}</span>}
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              ))}
              {!isLoading && !recent.length && <EmptyNote icon={Inbox}>No bookings yet.</EmptyNote>}
            </CardContent>
          </Card>
        </div>

        {/* ── Vehicle sales ──────────────────────────────────────────── */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vehicle sales</CardTitle>
            <CardDescription>Recorded by shops — sales are paid at the shop, not through the platform</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: Tag, label: "For sale now", value: (sales.for_sale ?? 0).toLocaleString(), tone: "bg-sky-500/10 text-sky-600" },
              { icon: MessageSquare, label: "Open enquiries", value: (sales.open_enquiries ?? 0).toLocaleString(), tone: "bg-violet-500/10 text-violet-600" },
              { icon: CheckCircle2, label: "Sold", value: (sales.sold ?? 0).toLocaleString(), tone: "bg-emerald-500/10 text-emerald-600" },
              { icon: HandCoins, label: "Value recorded", value: lkr(sales.sold_value ?? 0, true), tone: "bg-amber-500/10 text-amber-600" },
            ].map(({ icon: Icon, label, value, tone }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border p-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{isLoading ? "—" : value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

function EmptyNote({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5" /> {children}
    </div>
  );
}
