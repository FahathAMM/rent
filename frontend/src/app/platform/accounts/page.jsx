"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Clock3, Home, ListOrdered, Lock, ReceiptText, Scale } from "lucide-react";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import { OverviewTab } from "./components/OverviewTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { ACCOUNTS_SUMMARY_KEY } from "./components/labels";

const TRIGGER = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";

function Stat({ label, value, sub, Icon, tone, valueClass }) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("truncate text-xl font-bold tracking-tight tabular-nums", valueClass)}>{value}</p>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The platform's own books: what shops paid the platform (subscriptions, promotions), what the
 * platform spent, and the difference. Platform Owner only — the API refuses everyone else.
 */
export default function PlatformAccountsPage() {
  const isOwner = usePlatformAuthStore((s) => s.admin?.admin_role === "platform_owner");
  const { format } = useCurrencyFormat();
  const [tab, setTab] = useState("overview");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  // Only a finished range filters; half a range (start picked, end not yet) keeps the last view.
  const from = dateRange.from && dateRange.to ? dateRange.from : "";
  const to = dateRange.from && dateRange.to ? dateRange.to : "";

  const { data, isLoading } = useQuery({
    queryKey: [ACCOUNTS_SUMMARY_KEY, from, to],
    queryFn: () => platformService.accounts.summary({ from: from || undefined, to: to || undefined }).then((r) => r.data.data),
    enabled: isOwner,
  });

  const breadcrumb = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Accounts" },
  ];

  if (!isOwner) {
    return (
      <PageWrapper breadcrumb={breadcrumb}>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Lock className="h-5 w-5" /></div>
          <p className="text-base font-semibold">Platform Owner only</p>
          <p className="max-w-sm text-sm text-muted-foreground">The platform&apos;s accounts are open to the Platform Owner only.</p>
        </div>
      </PageWrapper>
    );
  }

  const dash = "—";
  const income = data?.income;
  const pending = data?.pending;

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader
        title="Accounts"
        description="What shops paid the platform, what the platform spent, and what is left. Booking money is not here: customers pay shops directly."
        action={<DateRangePicker placeholder="This year so far" className="w-full sm:w-64" value={dateRange} onChange={setDateRange} />}
      />

      <div className="space-y-6">
        {data && <p className="-mt-3 text-xs text-muted-foreground">Showing {formatDate(data.from)} to {formatDate(data.to)}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Money in" Icon={ArrowDownLeft}
            value={isLoading ? dash : format(income?.total ?? 0)}
            sub={isLoading ? undefined : `${format(income?.subscriptions.amount ?? 0)} subscriptions · ${format(income?.promotions.amount ?? 0)} promotions`}
            tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          />
          <Stat
            label="Expenses" Icon={ArrowUpRight}
            value={isLoading ? dash : format(data?.expenses.total ?? 0)}
            sub={isLoading ? undefined : `${data?.expenses.count ?? 0} recorded`}
            tone="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          />
          <Stat
            label={data && data.net < 0 ? "Loss" : "Profit"} Icon={Scale}
            value={isLoading ? dash : format(data?.net ?? 0)}
            sub="Money in minus expenses"
            valueClass={data && data.net < 0 ? "text-destructive" : undefined}
            tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          />
          <Stat
            label="Waiting to be checked" Icon={Clock3}
            value={isLoading ? dash : `${pending?.count ?? 0} payment${pending?.count === 1 ? "" : "s"}`}
            sub={isLoading ? undefined : pending?.count ? `${format(pending.amount)} not counted yet` : "Nothing waiting"}
            tone={pending?.count ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="h-auto gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="overview" className={TRIGGER}><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="transactions" className={TRIGGER}><ListOrdered className="h-4 w-4" /> Transactions</TabsTrigger>
            <TabsTrigger value="expenses" className={TRIGGER}><ReceiptText className="h-4 w-4" /> Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0"><OverviewTab data={data} isLoading={isLoading} /></TabsContent>
          <TabsContent value="transactions" className="mt-0"><TransactionsTab from={from} to={to} /></TabsContent>
          <TabsContent value="expenses" className="mt-0"><ExpensesTab from={from} to={to} /></TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Payments are approved under <Link href="/platform/subscriptions" className="text-primary hover:underline">Subscriptions</Link> and{" "}
          <Link href="/platform/promotions" className="text-primary hover:underline">Promotions</Link>; an approved payment shows here on the day it was approved.
        </p>
      </div>
    </PageWrapper>
  );
}
