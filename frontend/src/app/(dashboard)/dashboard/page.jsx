"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDashboard } from "@/hooks/useDashboard";
import { useCompanyCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";
import { cn, formatDate } from "@/lib/utils";
import {
  ShieldCheck, LayoutList, Settings2, ShieldAlert, TrendingUp, TrendingDown,
  Wallet, ReceiptText, CreditCard, Truck, Contact, ShoppingCart, PieChart as PieChartIcon,
  BarChart3, ShoppingBag, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];
const STATUS_COLOR_HEX = { pending: "#f59e0b", received: "#22c55e", cancelled: "#ef4444" };

const COLORS = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100", border: "border-blue-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", border: "border-emerald-200" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100", border: "border-violet-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100", border: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-100", border: "border-red-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-100", border: "border-rose-200" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-100", border: "border-cyan-200" },
  slate: { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200", border: "border-slate-300" },
};

/** Compact stat chip for the top KPI ribbon — icon + value/label, sized to sit in one row. */
function KpiChip({ title, value, icon: Icon, href, color = "slate" }) {
  const c = COLORS[color] ?? COLORS.slate;
  const body = (
    <div
      className={cn(
        "flex h-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-sm transition-all duration-200",
        c.border,
        href && "hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", c.bg, c.ring)}>
        <Icon className={cn("h-4 w-4", c.text)} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight tracking-tight tabular-nums text-foreground">{value}</p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">{title}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** Slim quick-link pill for the admin strip. */
function QuickLink({ title, icon: Icon, href, color = "slate" }) {
  const c = COLORS[color] ?? COLORS.slate;
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
    >
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1", c.bg, c.ring)}>
        <Icon className={cn("h-3.5 w-3.5", c.text)} />
      </span>
      {title}
    </Link>
  );
}

function ChartCard({ title, icon: Icon, color = "blue", className, children }) {
  const c = COLORS[color] ?? COLORS.blue;
  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm", className)}>
      <CardHeader className="flex shrink-0 flex-row items-center space-y-0 gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1", c.bg, c.ring)}>
          <Icon className={cn("h-3.5 w-3.5", c.text)} />
        </span>
        <CardTitle className="truncate text-xs font-semibold leading-none tracking-tight text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-2">{children}</CardContent>
    </Card>
  );
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, index }) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 14;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill={PIE_COLORS[index % PIE_COLORS.length]} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

function EmptyChart({ icon: Icon, text }) {
  return (
    <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-6 w-6 text-muted-foreground/40" />
      {text}
    </div>
  );
}

const tooltipStyle = { borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };

export default function DashboardPage() {
  const { data } = useDashboard();
  const formatCurrency = useCompanyCurrencyFormat();
  const { hasRole } = usePermission();
  const authUser = useAuthStore((s) => s.user);
  const isManager = hasRole("owner") || hasRole("admin");
  const [tab, setTab] = useState("purchases");

  const kpis = data?.kpis;

  return (
    <div className="space-y-4 p-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Welcome{authUser?.name ? `, ${authUser.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.company_name ?? "Your workspace"} at a glance.
        </p>
      </div>

      {/* KPI ribbon — one compact row, ERP-style */}
      <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        <KpiChip title="Sales (Mo)" icon={TrendingUp} href="/sales" color="emerald" value={formatCurrency(kpis?.sales_this_month)} />
        <KpiChip title="Purchases (Mo)" icon={ShoppingCart} href="/purchases" color="amber" value={formatCurrency(kpis?.purchases_this_month)} />
        <KpiChip title="Expenses (Mo)" icon={TrendingDown} href="/expenses" color="rose" value={formatCurrency(kpis?.expenses_this_month)} />
        <KpiChip
          title="Net Profit (Mo)"
          icon={Wallet}
          color={(kpis?.net_profit_this_month ?? 0) >= 0 ? "blue" : "red"}
          value={formatCurrency(kpis?.net_profit_this_month)}
        />
        <KpiChip title="Receivables" icon={ReceiptText} href="/sales" color="blue" value={formatCurrency(kpis?.receivables)} />
        <KpiChip
          title="Payables"
          icon={CreditCard}
          href="/purchases"
          color={(kpis?.payables ?? 0) > 0 ? "red" : "emerald"}
          value={formatCurrency(kpis?.payables)}
        />
        <KpiChip title="Vendors" icon={Truck} href="/vendors" color="violet" value={kpis?.total_vendors ?? "—"} />
        <KpiChip title="Customers" icon={Contact} href="/customers" color="cyan" value={kpis?.total_customers ?? "—"} />
      </div>

      {/* Bento grid — the three columns stretch to match the tallest (the middle stack) */}
      <div className="grid grid-cols-12 gap-3">
        {/* Cash flow hero + purchase status / expense breakdown */}
        <div className="col-span-12 flex flex-col gap-3 lg:col-span-6">
          <ChartCard title="Cash Flow — Sales vs Purchases vs Expenses (last 6 months)" icon={BarChart3} color="emerald">
            {!data?.cash_flow_trend?.some((row) => row.sales || row.purchases || row.expenses) ? (
              <EmptyChart icon={BarChart3} text="No sales, purchases or expenses in the last 6 months." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.cash_flow_trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} width={36} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="sales" name="Sales" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="grid grid-cols-2 gap-3">
            <ChartCard title="Purchase Status" icon={ClipboardList} color="amber">
              {!data?.purchase_status?.length ? (
                <EmptyChart icon={ClipboardList} text="No purchases yet." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={data.purchase_status} layout="vertical" margin={{ left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="status" width={60} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v} />
                    <Tooltip contentStyle={{ ...tooltipStyle, textTransform: "capitalize" }} />
                    <Bar dataKey="count" name="Purchases" radius={[0, 4, 4, 0]} maxBarSize={16}>
                      {data.purchase_status.map((row, i) => <Cell key={i} fill={STATUS_COLOR_HEX[row.status] ?? "#94a3b8"} />)}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Expenses by Category (last 6 mo)" icon={PieChartIcon} color="violet">
              {!data?.expense_breakdown?.length ? (
                <EmptyChart icon={PieChartIcon} text="No expenses in the last 6 months." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.expense_breakdown}
                      dataKey="total"
                      nameKey="category"
                      innerRadius="40%"
                      outerRadius="60%"
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine={{ stroke: "hsl(var(--border))" }}
                    >
                      {data.expense_breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>

        {/* Middle — top vendors + top selling items */}
        <div className="col-span-12 flex flex-col gap-3 sm:col-span-6 lg:col-span-3">
          <ChartCard title="Top Vendors (last 6 mo)" icon={Truck} color="violet">
            {!data?.top_vendors?.length ? (
              <EmptyChart icon={Truck} text="No purchases in the last 6 months." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.top_vendors} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="vendor" width={90} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" name="Purchases" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top Selling Items (last 6 mo)" icon={ShoppingBag} color="emerald">
            {!data?.top_items?.length ? (
              <EmptyChart icon={ShoppingBag} text="No sales in the last 6 months." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.top_items} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="item" width={90} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" name="Revenue" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Right — tabbed activity panel: purchases / sales / expenses in one card */}
        <Card className="col-span-12 flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm sm:col-span-6 lg:col-span-3">
          <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
            <CardHeader className="shrink-0 gap-0 border-b border-border/60 bg-muted/30 px-2 py-2">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
                <TabsTrigger value="purchases" className="gap-1.5 text-[11px] text-amber-600/70 data-[state=active]:text-amber-600">
                  <ShoppingCart className="h-3.5 w-3.5" />Purchases
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-1.5 text-[11px] text-emerald-600/70 data-[state=active]:text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />Sales
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-1.5 text-[11px] text-rose-600/70 data-[state=active]:text-rose-600">
                  <TrendingDown className="h-3.5 w-3.5" />Expenses
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
              <TabsContent value="purchases" className="mt-0">
                {!data?.recent_purchases?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No purchases yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {data.recent_purchases.map((p) => (
                      <Link key={p.id} href={`/purchases/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-muted/50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                          <ShoppingCart className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs font-medium text-foreground">{p.purchase_number}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.vendor} · {formatDate(p.purchase_date)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(p.total)}</p>
                          <StatusBadge status={p.status} className="mt-0.5 text-[10px]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="mt-0">
                {!data?.recent_sales?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {data.recent_sales.map((s) => (
                      <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-muted/50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                          <TrendingUp className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs font-medium text-foreground">{s.sale_number}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.customer} · {formatDate(s.sale_date)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(s.total)}</p>
                          <StatusBadge status={s.status} className="mt-0.5 text-[10px]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="mt-0">
                {!data?.recent_expenses?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {data.recent_expenses.map((e) => (
                      <Link key={e.id} href="/expenses" className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-muted/50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                          <TrendingDown className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs font-medium text-foreground">{e.expense_number}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.category} · {formatDate(e.expense_date)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-rose-600">{formatCurrency(e.total)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
            <div className="shrink-0 border-t border-border/60 px-3 py-2">
              <Link
                href={tab === "purchases" ? "/purchases" : tab === "sales" ? "/sales" : "/expenses"}
                className={cn(
                  "text-xs font-semibold hover:underline",
                  tab === "purchases" && "text-amber-600",
                  tab === "sales" && "text-emerald-600",
                  tab === "expenses" && "text-rose-600",
                )}
              >
                View all {tab} →
              </Link>
            </div>
          </Tabs>
        </Card>
      </div>

      {/* Admin quick links — slim strip, no card bulk */}
      {isManager && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1", COLORS.slate.bg, COLORS.slate.ring)}>
            <ShieldAlert className={cn("h-3.5 w-3.5", COLORS.slate.text)} />
          </span>
          <QuickLink title="Roles" icon={ShieldCheck} href="/roles" color="violet" />
          <QuickLink title="Menus" icon={LayoutList} href="/menus" color="amber" />
          <QuickLink title="Settings" icon={Settings2} href="/settings/company" color="slate" />
        </div>
      )}
    </div>
  );
}
