"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CarFront, Check, Clock3, Crown, FileText, Home, Landmark, Loader2, MapPin, Minus, ReceiptText, Upload, Users } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, openBlob } from "@/lib/utils";
import { PayDialog } from "./components/PayDialog";
import { SUBSCRIPTION_SUMMARY_KEY } from "./components/useSubscription";
import { planAccent, periodLabel } from "./components/planStyle";
import { toast } from "sonner";

const STATE = {
  trial: { label: "Free trial", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  grace: { label: "Ended — renew now", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
  unpaid: { label: "Not paid — workspace locked", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
};

/** One limit: used / allowed, with a bar. null max = unlimited. */
function UsageTile({ Icon, label, used, max }) {
  const unlimited = max === null || max === undefined;
  const pct = unlimited ? 0 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  const over = !unlimited && used > max;
  const full = !unlimited && used >= max;
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</span>
        {over && <span className="rounded-full bg-red-500/10 px-1.5 text-[10px] font-medium text-red-600">Over limit</span>}
        {!over && full && <span className="rounded-full bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700">Full</span>}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums">
        {used}<span className="text-sm font-normal text-muted-foreground"> / {unlimited ? "∞" : max}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : full ? "bg-amber-500" : "bg-primary")} style={{ width: unlimited ? "6%" : `${Math.max(pct, used ? 6 : 0)}%` }} />
      </div>
    </div>
  );
}

function Step({ n, Icon, title, text }) {
  return (
    <div className="flex gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{n}</span>
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export default function VendorSubscriptionPage() {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [paying, setPaying] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-subscription"],
    queryFn: () => vendorService.subscription.get().then((r) => r.data.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vendor-subscription"] });
    qc.invalidateQueries({ queryKey: SUBSCRIPTION_SUMMARY_KEY });
  };

  const viewProof = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const res = await vendorService.subscription.proof(id);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Could not open the receipt");
    }
  };

  const breadcrumb = [
    { label: "Dashboard", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Settings" },
    { label: "Subscription" },
  ];

  if (isLoading || !data) {
    return <PageWrapper breadcrumb={breadcrumb}><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></PageWrapper>;
  }

  const { current, plans, features, payments } = data;
  const state = STATE[current.state] ?? STATE.unpaid;
  const unpaid = current.state === "unpaid";
  const currentIndex = plans.findIndex((p) => p.id === current.plan.id);
  const accent = planAccent(current.plan.code, Math.max(0, currentIndex));
  const pending = payments.find((p) => p.status === "pending");
  const urgent = unpaid || current.state === "grace" || (current.state === "trial" && current.days_left <= 7);

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader title="Subscription" description="Your shop's plan, what it includes, and paying for it." />

      <div className="space-y-6">
        {/* ── Current plan ─────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className={cn("grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]", accent.band)}>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current plan</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 shadow-sm"><Crown className={cn("h-5 w-5", accent.icon)} /></span>
                <span className="text-3xl font-bold tracking-tight">{current.plan.name}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", state.cls)}>{state.label}</span>
              </div>

              {!unpaid && current.days_left !== null && (
                <div className="flex items-end gap-2">
                  <span className={cn("text-4xl font-bold leading-none tabular-nums", urgent ? "text-red-600" : "text-foreground")}>{current.days_left}</span>
                  <span className="pb-0.5 text-sm text-muted-foreground">day{current.days_left === 1 ? "" : "s"} left</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {current.state === "trial" && <>Trial ends <b className="text-foreground">{formatDateTime(current.ends_at)}</b>. Pay for a plan before then to keep the vendor workspace open.</>}
                {current.state === "active" && <>Paid until <b className="text-foreground">{formatDateTime(current.ends_at)}</b>. Renewing adds time after this date.</>}
                {current.state === "grace" && <>Ended {formatDateTime(current.ends_at)}. Renew by <b className="text-red-600">{formatDateTime(current.grace_ends_at)}</b> or the vendor workspace closes.</>}
                {unpaid && <>Your listings are still live for customers, but the vendor workspace is <b className="text-foreground">closed until a plan is paid for</b>. Choose a plan below — it opens again as soon as the platform confirms your payment.</>}
              </p>

              {pending && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Payment <span className="font-mono">{pending.reference_no}</span> ({format(pending.amount)} for {pending.plan}) is waiting for the platform to confirm it.</span>
                </div>
              )}
            </div>

            <div className={cn("grid content-start gap-3 sm:grid-cols-3", unpaid && "hidden")}>
              <UsageTile Icon={CarFront} label="Vehicles" used={current.usage.vehicles} max={current.plan.max_vehicles} />
              <UsageTile Icon={Users} label="Staff" used={current.usage.staff} max={current.plan.max_staff} />
              <UsageTile Icon={MapPin} label="Locations" used={current.usage.locations} max={current.plan.max_locations} />
              <div className="flex flex-wrap gap-1.5 sm:col-span-3">
                {Object.entries(features).map(([key, label]) => {
                  const on = current.features.includes(key);
                  return (
                    <span key={key} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", on ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-background/60 text-muted-foreground line-through")}>
                      {on ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Plans ────────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Plans</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, i) => {
              const a = planAccent(plan.code, i);
              const isCurrent = plan.id === current.plan.id;
              const isUpgrade = currentIndex >= 0 && i > currentIndex;
              return (
                <Card key={plan.id} className={cn("flex flex-col overflow-hidden rounded-2xl shadow-sm", isCurrent && `ring-2 ${a.ring}`)}>
                  <div className={cn("px-5 pb-4 pt-5", a.band)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-base font-semibold"><Crown className={cn("h-4 w-4", a.icon)} /> {plan.name}</p>
                      {isCurrent && <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium shadow-sm">Your plan</span>}
                    </div>
                    <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
                      {plan.price > 0 ? format(plan.price) : "Free"}
                      {plan.price > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">/ {periodLabel(plan.period_days)}</span>}
                    </p>
                    {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-4 p-5">
                    <div className="grid grid-cols-3 gap-2">
                      {[[CarFront, "Vehicles", plan.max_vehicles], [Users, "Staff", plan.max_staff], [MapPin, "Locations", plan.max_locations]].map(([Icon, label, n]) => (
                        <div key={label} className="rounded-xl border bg-muted/30 px-2 py-2.5 text-center">
                          <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
                          <p className="mt-1 text-lg font-semibold leading-none tabular-nums">{n === null || n === undefined ? "∞" : n}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-2 text-sm">
                      {Object.entries(features).map(([key, label]) => {
                        const on = plan.features.includes(key);
                        return (
                          <li key={key} className={cn("flex items-center gap-2", !on && "text-muted-foreground")}>
                            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", on ? "bg-emerald-500/15 text-emerald-600" : "bg-muted")}>
                              {on ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            </span>
                            <span className={cn(!on && "line-through")}>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {plan.price > 0 ? (
                      <Button className="mt-auto" variant={isCurrent ? "outline" : "default"} disabled={!!pending} onClick={() => setPaying(plan)}>
                        {isCurrent ? (current.state === "trial" ? "Pay to keep it" : "Renew") : unpaid ? `Choose ${plan.name}` : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                      </Button>
                    ) : (
                      <p className="mt-auto text-center text-xs text-muted-foreground">No payment needed.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {pending && <p className="mt-2 text-xs text-muted-foreground">You can choose another plan once the waiting payment is confirmed or rejected.</p>}
        </div>

        {/* ── How paying works + history ──────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">How paying works</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Step n={1} Icon={Crown} title="Choose a plan" text="Pick how many periods to pay for." />
              <Step n={2} Icon={Landmark} title="Transfer the amount" text="To the platform's bank account shown in the dialog." />
              <Step n={3} Icon={Upload} title="Upload the receipt" text="The platform checks it and your plan starts — or extends if it's the same plan." />
              <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">Switching to a different plan starts it straight away; any time left on the old one isn&apos;t carried over.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Payments</span>
                {payments.length > 0 && <span className="text-xs font-normal text-muted-foreground">{payments.length} sent</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!payments.length ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <CalendarClock className="h-6 w-6" />
                  No payments yet.
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-xl border">
                  {payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.plan} <span className="text-muted-foreground">× {p.periods}</span>
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.reference_no}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent {formatDateTime(p.created_at)}{p.bank_reference ? ` · ref ${p.bank_reference}` : ""}
                          {p.reviewed_at && p.status !== "pending" ? ` · checked ${formatDateTime(p.reviewed_at)}` : ""}
                        </p>
                        {p.reject_reason && <p className="text-xs text-destructive">Rejected: {p.reject_reason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-semibold">{format(p.amount)}</span>
                        <StatusBadge status={p.status} />
                        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => viewProof(p.id)}><FileText className="h-3.5 w-3.5" /> Receipt</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PayDialog plan={paying} bank={data.bank} open={!!paying} onOpenChange={(v) => !v && setPaying(null)} onPaid={refresh} />
    </PageWrapper>
  );
}
