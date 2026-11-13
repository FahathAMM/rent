"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { cn } from "@/lib/utils";
import {
  Wallet, Building2, Car, Home, Users, Star, Scale, Flag, CreditCard, Megaphone, Banknote, ClipboardList,
  TrendingUp, TrendingDown, Minus, ArrowUpRight, CheckCircle2, Store, Sparkles,
} from "lucide-react";

function lkr(amount, compact = false) {
  if (amount == null) return "—";
  const n = Number(amount);
  if (compact && n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (compact && n >= 10_000) return `LKR ${(n / 1_000).toFixed(0)}k`;
  return `LKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const num = (n) => (n ?? 0).toLocaleString();
const shortDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** % change vs the previous 30 days; null when there's nothing to compare against. */
function delta(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const QUEUES = [
  { key: "shop_verifications", label: "Shops to verify", href: "/platform/shops", icon: Building2 },
  { key: "listing_moderation", label: "Listings to check", href: "/platform/listings", icon: Car },
  { key: "reviews", label: "Reviews", href: "/platform/reviews", icon: Star },
  { key: "disputes", label: "Disputes", href: "/platform/disputes", icon: Scale },
  { key: "abuse_reports", label: "Abuse reports", href: "/platform/abuse-reports", icon: Flag },
  { key: "subscription_payments", label: "Plan payments", href: "/platform/subscriptions", icon: CreditCard },
  { key: "promotion_requests", label: "Promotions", href: "/platform/promotions", icon: Megaphone },
];

// New sign-ups chart: one line each. `text` colours the line (stroke="currentColor"), `dot` the legend.
const GROWTH = [
  { key: "shops", label: "Shops", text: "text-violet-500", dot: "bg-violet-500" },
  { key: "vehicles", label: "Vehicles", text: "text-amber-500", dot: "bg-amber-500" },
  { key: "customers", label: "Customers", text: "text-sky-500", dot: "bg-sky-500" },
];

// Where each verified shop's plan stands — from /platform/subscription-stats.
const PLAN_STATES = [
  { key: "active", label: "Paying", text: "text-emerald-500", dot: "bg-emerald-500" },
  { key: "grace", label: "In grace", text: "text-amber-500", dot: "bg-amber-500" },
  { key: "trial", label: "Free trial", text: "text-sky-500", dot: "bg-sky-500" },
  { key: "unpaid", label: "Unpaid (locked)", text: "text-rose-400", dot: "bg-rose-400" },
];

/* ─── Small pieces ────────────────────────────────────────────────────── */

function Delta({ value }) {
  if (value == null) return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600"><Sparkles className="h-3 w-3" />new</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
      value > 0 ? "bg-emerald-500/10 text-emerald-600" : value < 0 ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
    )}>
      <Icon className="h-3 w-3" />{value > 0 ? "+" : ""}{value}%
    </span>
  );
}

/** One number in the top strip. */
function Kpi({ icon: Icon, label, value, sub, change, tone, loading, href }) {
  const body = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
          {!loading && change !== undefined && <Delta value={change} />}
        </div>
        <p className="truncate text-lg font-bold leading-tight tracking-tight tabular-nums">{loading ? "—" : value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{loading ? " " : sub}</p>
      </div>
    </>
  );
  const box = "flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-sm";
  return href
    ? <Link href={href} className={cn(box, "transition-colors hover:bg-muted/40")}>{body}</Link>
    : <div className={box}>{body}</div>;
}

/** A dashboard box. Its height is fixed by the caller, so the body must not grow it. */
function Panel({ title, sub, action, className, children }) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
      {items.map(({ label, value, dot }) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span className={cn("size-2 shrink-0 rounded-full", dot)} />{label}
          <span className="font-semibold tabular-nums text-foreground">{value}</span>
        </span>
      ))}
    </div>
  );
}

/* ─── Charts ──────────────────────────────────────────────────────────── */

/** Money shops paid the platform, one bar per day. Hovering a bar names it in the panel's subtitle. */
function IncomeBars({ days, onHover, hover }) {
  const max = Math.max(...days.map((d) => d.income), 1);
  return (
    <>
      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute inset-0">
          {[0, 0.5].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${f * 100}%` }}>
              <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground">{lkr(Math.round(max * (1 - f)), true)}</span>
            </div>
          ))}
        </div>
        <div className="flex h-full items-end gap-[2px] border-b pr-14" onMouseLeave={() => onHover(null)}>
          {days.map((d, i) => (
            <div key={d.date} className="flex h-full flex-1 items-end" onMouseEnter={() => onHover(i)} title={`${shortDate(d.date)}: ${lkr(d.income)}`}>
              <div
                className={cn("w-full rounded-t-[3px] transition-opacity", d.income > 0 ? "bg-indigo-500" : "bg-muted", hover != null && hover !== i && "opacity-40")}
                style={{ height: d.income > 0 ? `${Math.max((d.income / max) * 100, 3)}%` : "2px" }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between pr-14 text-[10px] text-muted-foreground">
        <span>{days[0] && shortDate(days[0].date)}</span>
        <span>{days[14] && shortDate(days[14].date)}</span>
        <span>Today</span>
      </div>
    </>
  );
}

/** New shops, vehicles and customers per day as three lines on one scale. */
function GrowthLines({ days }) {
  const max = Math.max(...days.flatMap((d) => GROWTH.map((g) => d[g.key])), 1);
  const points = (key) => days.map((d, i) => `${(i / Math.max(days.length - 1, 1)) * 100},${96 - (d[key] / max) * 92}`).join(" ");
  return (
    <>
      <div className="relative min-h-0 flex-1 border-b">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70">
          <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground">{max}</span>
        </div>
        <div className="absolute inset-y-0 left-0 right-6">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="New shops, vehicles and customers per day">
            {GROWTH.map((g) => (
              <polyline key={g.key} points={points(g.key)} className={g.text} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-1 flex justify-between pr-6 text-[10px] text-muted-foreground">
        <span>{days[0] && shortDate(days[0].date)}</span>
        <span>Today</span>
      </div>
    </>
  );
}

/** A ring split into parts, with one figure in the middle. `parts`: [{ label, value, text, dot, display }]. */
function Donut({ parts, center, centerLabel, stacked = false }) {
  const total = parts.reduce((sum, p) => sum + (p.value || 0), 0);
  // Each slice starts where the one before ended; 25 puts the first at 12 o'clock.
  const slices = parts.map((p, i) => {
    const pct = total > 0 ? ((p.value || 0) / total) * 100 : 0;
    const before = parts.slice(0, i).reduce((sum, q) => sum + (total > 0 ? ((q.value || 0) / total) * 100 : 0), 0);
    return { ...p, pct, dashoffset: 25 - before };
  });
  return (
    // stacked: ring above its legend, for narrow panels; otherwise ring and legend side by side.
    <div className={cn("flex min-h-0 flex-1", stacked ? "flex-col gap-1.5" : "items-center gap-3")}>
      <div className={cn("relative min-h-0", stacked ? "w-full flex-1" : "aspect-square h-full max-h-36 shrink-0")}>
        <svg viewBox="0 0 42 42" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="5" className="stroke-muted" />
          {slices.map((p) => p.pct > 0 && (
            <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" strokeWidth="5" stroke="currentColor" className={p.text} strokeDasharray={`${p.pct} ${100 - p.pct}`} strokeDashoffset={p.dashoffset}>
              <title>{`${p.label}: ${p.display ?? p.value} (${Math.round(p.pct)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold leading-none tabular-nums">{center}</span>
          <span className="mt-0.5 text-[9px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className={cn("min-w-0 text-[11px]", stacked ? "w-full shrink-0 space-y-0.5" : "flex-1 space-y-1")}>
        {slices.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground"><span className={cn("size-2 shrink-0 rounded-full", p.dot)} /><span className="truncate">{p.label}</span></span>
            <span className="shrink-0 font-semibold tabular-nums">{p.display ?? num(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The last 12 months, one stacked bar each: subscriptions below, promotions on top. */
function MonthBars({ months }) {
  const max = Math.max(...months.map((m) => m.subscriptions + m.promotions), 1);
  const name = (key, style) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString("en-GB", { month: style });
  return (
    <>
      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70">
          <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground">{lkr(max, true)}</span>
        </div>
        <div className="flex h-full items-end gap-1 border-b">
          {months.map((m) => {
            const total = m.subscriptions + m.promotions;
            return (
              <div key={m.month} className="flex h-full flex-1 flex-col justify-end gap-px" title={`${name(m.month, "long")}: ${lkr(m.subscriptions)} subscriptions, ${lkr(m.promotions)} promotions`}>
                {total > 0 ? (
                  <>
                    {m.promotions > 0 && <div className="w-full rounded-t-[3px] bg-amber-500" style={{ height: `${(m.promotions / max) * 100}%` }} />}
                    {m.subscriptions > 0 && <div className={cn("w-full bg-indigo-500", !m.promotions && "rounded-t-[3px]")} style={{ height: `${(m.subscriptions / max) * 100}%` }} />}
                  </>
                ) : <div className="h-[2px] w-full bg-muted" />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1 text-center text-[9px] text-muted-foreground">
        {months.map((m) => <span key={m.month} className="flex-1">{name(m.month, "narrow")}</span>)}
      </div>
    </>
  );
}

/** A short ranked list, each row with a bar showing its share of the biggest. `rows`: [{ key, label, value, display, href }]. */
function RankList({ rows, barCls, empty }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <p className="m-auto text-center text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-around gap-1.5 overflow-hidden">
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium group-hover:text-primary"><span className="mr-1.5 text-muted-foreground">{i + 1}</span>{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{r.display ?? num(r.value)}</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", barCls)} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </>
        );
        return r.href
          ? <Link key={r.key} href={r.href} className="group block min-w-0">{body}</Link>
          : <div key={r.key} className="min-w-0">{body}</div>;
      })}
    </div>
  );
}

// Vehicles by category: up to four categories and "Other".
const CATEGORY_COLOURS = [
  { text: "text-indigo-500", dot: "bg-indigo-500" },
  { text: "text-emerald-500", dot: "bg-emerald-500" },
  { text: "text-amber-500", dot: "bg-amber-500" },
  { text: "text-sky-500", dot: "bg-sky-500" },
  { text: "text-slate-400", dot: "bg-slate-400" },
];

/** One horizontal bar split into parts. `parts`: [{ label, value, cls }]. */
function SplitBar({ icon: Icon, label, total, parts }) {
  const sum = parts.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}</span>
        <span className="font-bold tabular-nums">{num(total)}</span>
      </div>
      <div className="mt-1 flex h-2 gap-[2px] overflow-hidden rounded-full bg-muted">
        {sum > 0 && parts.map((p) => p.value > 0 && <div key={p.label} className={cn("h-full", p.cls)} style={{ width: `${(p.value / sum) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{parts.map((p) => `${num(p.value)} ${p.label.toLowerCase()}`).join(" · ")}</p>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

/**
 * The platform's own picture on one screen: who is on it, what shops paid the platform, what is
 * waiting. A shop's own business (bookings, booked value, vehicle sales) is deliberately not
 * here — see /platform/bookings and /platform/payments for that.
 *
 * The top strip and the first row of charts are what you see without scrolling; the remaining
 * charts sit below in rows of three.
 */
export default function PlatformDashboardPage() {
  const isOwner = usePlatformAuthStore((s) => s.admin?.admin_role === "platform_owner");
  const [hover, setHover] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: () => platformService.dashboard.getSummary().then((r) => r.data.data),
  });
  const { data: plans } = useQuery({
    queryKey: ["platform-subscription-stats"],
    queryFn: () => platformService.subscriptions.stats().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const income = data?.income ?? {};
  const subscriptions = income.subscriptions ?? {};
  const promotions = income.promotions ?? {};
  const pending = income.pending ?? {};
  const queues = data?.queues ?? {};
  const community = data?.community ?? {};
  const trend = data?.trend ?? {};
  const days = trend.days ?? [];
  const cur = trend.current ?? {};
  const prev = trend.previous ?? {};
  const topShops = data?.top_shops ?? [];
  const months = data?.income_months ?? [];
  const categories = data?.vehicles_by_category ?? [];
  const districts = data?.shops_by_district ?? [];

  const waiting = QUEUES.reduce((sum, q) => sum + (queues[q.key] ?? 0), 0);
  const planShops = plans?.shops ?? {};
  const planTotal = PLAN_STATES.reduce((sum, s) => sum + (planShops[s.key] ?? 0), 0);
  const byPlan = Object.entries(plans?.paying_by_plan ?? {}).map(([name, n]) => `${n} ${name}`).join(" · ");
  const otherShops = Math.max(0, (community.shops ?? 0) - (community.verified_shops ?? 0) - (community.pending_shops ?? 0));
  const hovered = hover != null ? days[hover] : null;
  const yearIncome = months.reduce((sum, m) => sum + m.subscriptions + m.promotions, 0);

  // Panel heights: the top strip and the first chart row fill the first screen, the rest sit below it.
  const WIDE = "h-64";
  const SMALL = "h-56";

  return (
    <PageWrapper breadcrumb={[{ label: "Dashboard", icon: <Home className="size-4" /> }]} maxWidth="max-w-none" className="p-3 pb-3 sm:p-3 sm:pb-3" childMaxWidth="space-y-0 shadow-none">
      <div className="grid gap-3">
        {/* ── Top strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Banknote} label="Income · all time" value={lkr(income.total, true)} sub={`${num(income.paying_shops)} shops have paid`} tone="bg-indigo-500/10 text-indigo-600" loading={isLoading} href={isOwner ? "/platform/accounts" : undefined} />
          <Kpi icon={Wallet} label="Income · 30 days" value={lkr(cur.income, true)} sub={`${lkr(income.this_month ?? 0, true)} this month`} change={delta(cur.income ?? 0, prev.income ?? 0)} tone="bg-emerald-500/10 text-emerald-600" loading={isLoading} />
          <Kpi icon={Store} label="Shops" value={num(community.shops)} sub={`${num(community.verified_shops)} verified`} change={delta(cur.shops ?? 0, prev.shops ?? 0)} tone="bg-violet-500/10 text-violet-600" loading={isLoading} href="/platform/shops" />
          <Kpi icon={Users} label="Vendors" value={num(community.vendors)} sub={`${num(community.shop_owners)} owners · ${num(community.shop_staff)} staff`} tone="bg-sky-500/10 text-sky-600" loading={isLoading} />
          <Kpi icon={Car} label="Vehicles" value={num(community.vehicles)} sub={`${num(community.published_vehicles)} live on the site`} change={delta(cur.vehicles ?? 0, prev.vehicles ?? 0)} tone="bg-amber-500/10 text-amber-600" loading={isLoading} href="/platform/listings" />
          <Kpi icon={ClipboardList} label="Waiting for review" value={num(waiting)} sub={pending.count ? `${lkr(pending.amount, true)} in payments to check` : "No payments to check"} tone={waiting ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"} loading={isLoading} />
        </div>

        {/* ── Row 1: income per day, income per month, sign-ups, income split ── */}
        <div className="grid min-h-0 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <Panel
            className={cn(WIDE, "xl:col-span-4")}
            title="Income · last 30 days"
            sub={hovered ? `${lkr(hovered.income)} on ${shortDate(hovered.date)}` : `Total ${lkr(cur.income ?? 0)} · by the day a payment was approved`}
            action={isOwner && <Link href="/platform/accounts" className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline">Accounts <ArrowUpRight className="h-3 w-3" /></Link>}
          >
            <IncomeBars days={days} hover={hover} onHover={setHover} />
          </Panel>

          <Panel className={cn(WIDE, "xl:col-span-3")} title="Income · last 12 months" sub={`Total ${lkr(yearIncome, true)}`}>
            <Legend items={[
              { label: "Subscriptions", dot: "bg-indigo-500", value: lkr(months.reduce((s, m) => s + m.subscriptions, 0), true) },
              { label: "Promotions", dot: "bg-amber-500", value: lkr(months.reduce((s, m) => s + m.promotions, 0), true) },
            ]} />
            <div className="mt-2 flex min-h-0 flex-1 flex-col"><MonthBars months={months} /></div>
          </Panel>

          <Panel className={cn(WIDE, "xl:col-span-3")} title="New sign-ups · last 30 days" sub="Per day">
            <Legend items={GROWTH.map((g) => ({ label: g.label, dot: g.dot, value: num(cur[g.key]) }))} />
            <div className="mt-2 flex min-h-0 flex-1 flex-col"><GrowthLines days={days} /></div>
          </Panel>

          <Panel className={cn(WIDE, "xl:col-span-2")} title="Money from shops" sub="All time">
            <Donut
              stacked center={lkr(income.total ?? 0, true)} centerLabel="total"
              parts={[
                { label: `Subscriptions (${num(subscriptions.count)})`, value: subscriptions.amount ?? 0, display: lkr(subscriptions.amount ?? 0, true), text: "text-indigo-500", dot: "bg-indigo-500" },
                { label: `Promotions (${num(promotions.count)})`, value: promotions.amount ?? 0, display: lkr(promotions.amount ?? 0, true), text: "text-amber-500", dot: "bg-amber-500" },
              ]}
            />
          </Panel>
        </div>

        {/* ── Row 2: plans, vehicles, districts, who is here, top shops, queues ── */}
        <div className="grid min-h-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Panel className={SMALL} title="Subscription plans" sub={byPlan || "No paying shops yet"}>
            <Donut
              center={num(planTotal)} centerLabel="shops"
              parts={PLAN_STATES.map((s) => ({ label: s.label, value: planShops[s.key] ?? 0, text: s.text, dot: s.dot }))}
            />
          </Panel>

          <Panel className={SMALL} title="Vehicles by category" sub={`${num(community.published_vehicles)} of ${num(community.vehicles)} live`}>
            <Donut
              center={num(community.vehicles)} centerLabel="vehicles"
              parts={categories.map((c, i) => ({ label: c.name, value: c.vehicles, ...CATEGORY_COLOURS[i % CATEGORY_COLOURS.length] }))}
            />
          </Panel>

          <Panel className={SMALL} title="Shops by district" sub="Top 5">
            <RankList
              barCls="bg-violet-500" empty={isLoading ? "" : "No shops yet."}
              rows={districts.map((d) => ({ key: d.district, label: d.district, value: d.shops }))}
            />
          </Panel>

          <Panel className={SMALL} title="On the platform" sub={`${num(community.customers)} customers`}>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-2 overflow-hidden">
              <SplitBar icon={Store} label="Shops" total={community.shops} parts={[
                { label: "Verified", value: community.verified_shops ?? 0, cls: "bg-violet-500" },
                { label: "Waiting", value: community.pending_shops ?? 0, cls: "bg-amber-500" },
                { label: "Other", value: otherShops, cls: "bg-slate-400" },
              ]} />
              <SplitBar icon={Car} label="Vehicles" total={community.vehicles} parts={[
                { label: "Live", value: community.published_vehicles ?? 0, cls: "bg-emerald-500" },
                { label: "Not live", value: Math.max(0, (community.vehicles ?? 0) - (community.published_vehicles ?? 0)), cls: "bg-slate-400" },
              ]} />
              <SplitBar icon={Users} label="Vendors" total={community.vendors} parts={[
                { label: "Owners", value: community.shop_owners ?? 0, cls: "bg-sky-500" },
                { label: "Staff", value: community.shop_staff ?? 0, cls: "bg-sky-300" },
              ]} />
            </div>
          </Panel>

          <Panel className={SMALL} title="Top paying shops" sub="All time">
            <RankList
              barCls="bg-indigo-500" empty={isLoading ? "" : "No shop has paid yet."}
              rows={topShops.map((s) => ({ key: s.id, label: s.name, value: s.amount, display: lkr(s.amount, true), href: `/platform/shops/${s.id}` }))}
            />
          </Panel>

          <Panel
            className={SMALL} title="Needs attention"
            sub={isLoading ? "Review queues" : waiting ? `${waiting} waiting` : "All clear"}
          >
            <div className="flex min-h-0 flex-1 flex-col justify-around overflow-hidden">
              {QUEUES.map(({ key, label, href, icon: Icon }) => {
                const n = queues[key] ?? 0;
                return (
                  <Link key={key} href={href} title={label} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted/60">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", n ? "text-amber-600" : "text-muted-foreground")} />
                    <span className={cn("flex-1 truncate", !n && "text-muted-foreground")}>{label}</span>
                    {n ? (
                      <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-[10px] font-bold leading-4 text-white">{n}</span>
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="all clear" />
                    )}
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </PageWrapper>
  );
}
