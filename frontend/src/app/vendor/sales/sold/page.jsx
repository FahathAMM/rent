"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { formatDateTime, openBlob } from "@/lib/utils";
import { BadgeDollarSign, CalendarDays, CarFront, Eye, FileText, Home, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "bank_transfer", label: "Bank transfer", className: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "lease", label: "Lease", className: "bg-violet-50 text-violet-700 border-violet-200" },
  { value: "other", label: "Other", className: "bg-slate-50 text-slate-700 border-slate-200" },
];
const METHOD_BY_VALUE = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m]));

function PaymentBadge({ method }) {
  const meta = METHOD_BY_VALUE[method];
  if (!meta) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="outline" className={`font-medium ${meta.className}`}>{meta.label}</Badge>;
}

function StatTile({ label, value, hint, icon: Icon, tone }) {
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold leading-tight tracking-tight">{value}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SoldVehiclesPage() {
  const { format } = useCurrencyFormat();
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [method, setMethod] = useState("");

  const { data: summary = {}, isLoading } = useQuery({
    queryKey: ["vendor-sales-sold-summary"],
    queryFn: () => vendorService.sales.sold.summary().then((r) => r.data.data),
  });

  const openAgreement = (reference) => {
    const tab = window.open("", "_blank");
    vendorService.sales.sold.agreement(reference)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the sale agreement"); });
  };

  const columns = ({ sortField, sortOrder, handleSort }) => {
    const sortable = (label, column) => function SortableHeaderCell() {
      return <SortableHeader label={label} column={column} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />;
    };

    return [
      {
        accessorKey: "vehicle",
        header: "Vehicle",
        cell: (row) => {
          const v = row.vehicle;
          const spec = v ? [v.make, v.model, v.year].filter(Boolean).join(" ") : "";
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CarFront className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <Link href={`/vendor/sales/sold/${row.reference}`} className="block truncate font-medium hover:underline">
                  {v?.title ?? "Vehicle removed"}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">{spec || "—"}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: (row) => <span className="font-mono text-[11px] text-muted-foreground">{row.reference}</span>,
      },
      {
        accessorKey: "buyer_name",
        header: sortable("Buyer", "buyer_name"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.buyer_name}</p>
            {row.buyer_phone && <p className="truncate text-[11px] text-muted-foreground">{row.buyer_phone}</p>}
          </div>
        ),
      },
      { accessorKey: "payment_method", header: "Paid by", cell: (row) => <PaymentBadge method={row.payment_method} /> },
      {
        accessorKey: "sale_price",
        header: sortable("Sale price", "sale_price"),
        cell: (row) => <span className="font-semibold tabular-nums">{format(row.sale_price)}</span>,
      },
      {
        accessorKey: "sold_at",
        header: sortable("Sold on", "sold_at"),
        cell: (row) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.sold_at)}</span>,
      },
      {
        accessorKey: "actions",
        header: "",
        class: "w-20",
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <ActionButton onClick={() => openAgreement(row.reference)} icon={FileText} label="Sale agreement" className="text-slate-600 border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400" />
            <ActionButton href={`/vendor/sales/sold/${row.reference}`} icon={Eye} label="View sale" className="text-sky-700 border-sky-300 hover:text-sky-800 hover:bg-sky-50 hover:border-sky-400" />
          </div>
        ),
      },
    ];
  };

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Sold" },
  ];

  const money = (n) => (isLoading ? "—" : format(n ?? 0));
  const count = (n) => (isLoading ? "—" : (n ?? 0));

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      {/* HomePageWrapper has no side padding (tables bring their own), so the tiles line up with the table here. */}
      <div className="grid grid-cols-1 gap-3 px-3 pt-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Cars sold" value={count(summary.sold_count)} hint="All time" icon={CarFront} tone="bg-blue-100 text-blue-700" />
        <StatTile label="Total sales value" value={money(summary.sold_value)} hint="All time" icon={BadgeDollarSign} tone="bg-emerald-100 text-emerald-700" />
        <StatTile
          label="Sold this month"
          value={count(summary.sold_this_month)}
          hint={isLoading ? undefined : `${format(summary.sold_value_this_month ?? 0)} in sales`}
          icon={CalendarDays}
          tone="bg-amber-100 text-amber-700"
        />
        <StatTile label="Average sale price" value={money(summary.average_price)} hint="Per car sold" icon={TrendingUp} tone="bg-violet-100 text-violet-700" />
      </div>

      <ServerDataTable
        endpoint="/vendor/sales/sold"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="sold_at"
        defaultSortOrder="desc"
        filters={{
          payment_method: method || undefined,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }}
      >
        <Select value={method || "all"} onValueChange={(v) => setMethod(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-full text-sm sm:w-40"><SelectValue placeholder="Paid by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment types</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangePicker placeholder="Sold date range" className="w-full sm:w-60" value={dateRange} onChange={setDateRange} />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
