"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock3, Crown, Wallet } from "lucide-react";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const SUBSCRIPTION_STATS_KEY = ["platform-subscription-stats"];

export function useSubscriptionStats() {
  return useQuery({
    queryKey: SUBSCRIPTION_STATS_KEY,
    queryFn: () => platformService.subscriptions.stats().then((r) => r.data.data),
    staleTime: 30_000,
  });
}

function Stat({ label, value, sub, Icon, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-sm transition-colors", onClick && "hover:bg-muted/40")}>
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className="block w-full text-left">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>
            <Icon className="h-5 w-5" />
          </div>
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

/** Header numbers: payments waiting, money received this month, paying shops, trials. */
export function StatsRow({ onShowPending }) {
  const { format } = useCurrencyFormat();
  const { data, isLoading } = useSubscriptionStats();
  const dash = "—";
  const shops = data?.shops ?? {};
  const byPlan = Object.entries(data?.paying_by_plan ?? {}).map(([name, n]) => `${n} ${name}`).join(" · ");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Waiting to check"
        value={isLoading ? dash : `${data.pending.count} payment${data.pending.count === 1 ? "" : "s"}`}
        sub={isLoading ? undefined : data.pending.count ? `${format(data.pending.amount)} to confirm` : "Nothing waiting"}
        Icon={Clock3}
        tone={data?.pending.count ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}
        onClick={data?.pending.count ? onShowPending : undefined}
      />
      <Stat
        label="Received this month"
        value={isLoading ? dash : format(data.this_month.amount)}
        sub={isLoading ? undefined : `${data.this_month.count} approved payment${data.this_month.count === 1 ? "" : "s"}`}
        Icon={Wallet}
        tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      />
      <Stat
        label="Paying shops"
        value={isLoading ? dash : (shops.active ?? 0) + (shops.grace ?? 0)}
        sub={isLoading ? undefined : [byPlan, shops.grace ? `${shops.grace} in grace` : null].filter(Boolean).join(" · ") || "None yet"}
        Icon={Crown}
        tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
      />
      <Stat
        label="On free trial"
        value={isLoading ? dash : shops.trial ?? 0}
        sub={isLoading ? undefined : `${shops.trials_ending_soon ?? 0} ending in 7 days · ${shops.unpaid ?? 0} unpaid (locked)`}
        Icon={CalendarClock}
        tone="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
      />
    </div>
  );
}
