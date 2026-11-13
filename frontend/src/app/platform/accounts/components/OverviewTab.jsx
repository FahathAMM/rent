"use client";

import Link from "next/link";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { categoryLabel } from "./labels";

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** A name, an amount and a bar showing its share of the biggest row. */
function ShareRow({ label, sub, amount, max, tone, href }) {
  const { format } = useCurrencyFormat();
  const name = href ? <Link href={href} className="truncate font-medium hover:underline">{label}</Link> : <span className="truncate font-medium">{label}</span>;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-baseline gap-2">
          {name}
          <span className="shrink-0 text-[11px] text-muted-foreground">{sub}</span>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{format(amount)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${max > 0 ? Math.max(2, (amount / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

/** Month by month profit and loss, the shops that paid the most, and where the money went. */
export function OverviewTab({ data, isLoading }) {
  const { format } = useCurrencyFormat();
  // Newest month first; months before anything happened are left out of the top of the list.
  const months = [...(data?.months ?? [])].reverse();
  const shops = data?.top_shops ?? [];
  const categories = data?.expense_categories ?? [];
  const money = (n) => (Number(n) ? format(n) : "—");

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />;
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Month by month</CardTitle>
          <CardDescription>Money in is counted in the month a payment was approved; expenses in the month of their date.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="px-3 py-2 text-right font-medium">Subscriptions</th>
                  <th className="px-3 py-2 text-right font-medium">Promotions</th>
                  <th className="px-3 py-2 text-right font-medium">Money in</th>
                  <th className="px-3 py-2 text-right font-medium">Expenses</th>
                  <th className="py-2 pl-3 text-right font-medium">Profit / loss</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 font-medium">{monthLabel(m.month)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.subscriptions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(m.promotions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{money(m.income)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">{money(m.expenses)}</td>
                    <td className={cn("py-2 pl-3 text-right font-semibold tabular-nums", m.net < 0 && "text-destructive")}>
                      {m.income || m.expenses ? format(m.net) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && (
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{format(data.income.subscriptions.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{format(data.income.promotions.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{format(data.income.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">{format(data.expenses.total)}</td>
                    <td className={cn("py-2 pl-3 text-right tabular-nums", data.net < 0 && "text-destructive")}>{format(data.net)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shops that paid the most</CardTitle>
            <CardDescription>Subscriptions and promotions together, top 10.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {shops.length ? shops.map((s) => (
              <ShareRow
                key={s.id} label={s.name} href={`/platform/shops/${s.id}`}
                sub={`${s.payments} payment${s.payments === 1 ? "" : "s"}`}
                amount={s.amount} max={shops[0].amount} tone="bg-emerald-500"
              />
            )) : <Empty>No payments approved in this period.</Empty>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where the money went</CardTitle>
            <CardDescription>Expenses by category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.length ? categories.map((c) => (
              <ShareRow
                key={c.category} label={categoryLabel(c.category)}
                sub={`${c.entries} expense${c.entries === 1 ? "" : "s"}`}
                amount={c.amount} max={categories[0].amount} tone="bg-rose-500"
              />
            )) : <Empty>No expenses recorded in this period.</Empty>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
