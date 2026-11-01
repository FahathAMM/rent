"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock3, Home, Megaphone, Package, ReceiptText, Star, Wallet } from "lucide-react";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RequestsTab } from "./components/RequestsTab";
import { PackagesTab } from "./components/PackagesTab";

const STATS_KEY = ["platform-promotion-stats"];
const TRIGGER = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";

function Stat({ label, value, sub, Icon, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-sm", onClick && "transition-colors hover:bg-muted/40")}>
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className="block w-full text-left">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="truncate text-xl font-bold tracking-tight tabular-nums">{value}</p>
            {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </CardContent>
      </Tag>
    </Card>
  );
}

/** Paid visibility — featured vehicles and shop sponsorship (10-monetization.md 2.2). */
export default function PlatformPromotionsPage() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const isOwner = admin?.admin_role === "platform_owner";
  const { format } = useCurrencyFormat();
  const [tab, setTab] = useState("requests");
  const [status, setStatus] = useState("pending");
  const { data: s, isLoading } = useQuery({ queryKey: STATS_KEY, queryFn: () => platformService.promotions.stats().then((r) => r.data.data), staleTime: 30_000 });
  const dash = "—";

  const breadcrumb = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Promotions" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader title="Promotions" description="Featured vehicles (first in vehicle search) and sponsored shops (first on the Shops page) — payments to check, what's live, and the packages shops can buy." />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Waiting to check" Icon={Clock3}
            value={isLoading ? dash : `${s.pending.count} payment${s.pending.count === 1 ? "" : "s"}`}
            sub={isLoading ? undefined : s.pending.count ? `${format(s.pending.amount)} to confirm` : "Nothing waiting"}
            tone={s?.pending.count ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}
            onClick={s?.pending.count ? () => { setStatus("pending"); setTab("requests"); } : undefined}
          />
          <Stat label="Received this month" Icon={Wallet} value={isLoading ? dash : format(s.this_month.amount)} sub={isLoading ? undefined : `${s.this_month.count} approved`} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
          <Stat label="Featured live" Icon={Star} value={isLoading ? dash : `${s.live.featured} / ${s.slots.featured}`} sub={isLoading ? undefined : `${Math.max(0, s.slots.featured - s.live.featured)} slots free`} tone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            onClick={() => { setStatus("live"); setTab("requests"); }} />
          <Stat label="Sponsorships live" Icon={Megaphone} value={isLoading ? dash : s.live.sponsored} sub={isLoading ? undefined : `${s.scheduled} scheduled · ${s.slots.sponsored} per city`} tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            onClick={() => { setStatus("scheduled"); setTab("requests"); }} />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="h-auto gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="requests" className={TRIGGER}>
              <ReceiptText className="h-4 w-4" /> Payments & promotions
              {s?.pending.count > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{s.pending.count}</span>}
            </TabsTrigger>
            <TabsTrigger value="packages" className={TRIGGER}><Package className="h-4 w-4" /> Packages & slots</TabsTrigger>
          </TabsList>
          <TabsContent value="requests" className="mt-0"><RequestsTab status={status} onStatusChange={setStatus} statsKey={STATS_KEY} /></TabsContent>
          <TabsContent value="packages" className="mt-0"><PackagesTab canEdit={isOwner} /></TabsContent>
        </Tabs>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> To give a shop a free promotion, use Feature on a listing&apos;s page.
        </p>
      </div>
    </PageWrapper>
  );
}
