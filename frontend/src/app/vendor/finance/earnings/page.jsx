"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wallet, Banknote, Clock, Home } from "lucide-react";

function StatTile({ label, value, icon: Icon, tone }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const METHOD_LABELS = { cash: "Cash", bank_transfer: "Bank transfer" };

/** How much of the rental the shop has received so far (cash / bank transfer). */
function receiptStatus(row) {
  const received = Number(row.received_amount), due = Number(row.earnings_amount);
  if (received >= due && due > 0) return "received";
  return received > 0 ? "partially_paid" : "awaiting_payment";
}

export default function EarningsPage() {
  const { format } = useCurrencyFormat();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-earnings", from, to],
    queryFn: () => vendorService.earnings.summary({ from: from || undefined, to: to || undefined }).then((r) => r.data.data),
  });

  const summary = data?.summary ?? {};

  const columns = ({ sortField, sortOrder, handleSort }) => {
    const sortable = (label, column) => function SortHeader() { return <SortableHeader label={label} column={column} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />; };
    return [
      {
        accessorKey: "booking_reference",
        header: "Booking",
        cell: (row) => (
          <Link href={`/vendor/bookings/${row.booking_reference}`} className="font-medium text-primary hover:underline">{row.booking_reference}</Link>
        ),
      },
      { accessorKey: "pickup_at", header: sortable("Pickup", "pickup_at"), cell: (row) => formatDate(row.pickup_at) },
      { accessorKey: "payment_method", header: "Paid via", cell: (row) => METHOD_LABELS[row.payment_method] ?? row.payment_method },
      { accessorKey: "earnings_amount", header: sortable("Your Earnings", "earnings_amount"), cell: (row) => <span className="font-semibold">{format(row.earnings_amount)}</span> },
      { accessorKey: "received_amount", header: sortable("Received", "received_amount"), cell: (row) => format(row.received_amount) },
      { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={receiptStatus(row)} /> },
    ];
  };

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Earnings" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Pickup from</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Pickup to</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label={`Your Earnings · ${summary.bookings_count ?? 0} bookings`} value={isLoading ? "—" : format(summary.earnings_amount ?? 0)} icon={Wallet} tone="bg-blue-100 text-blue-700" />
        <StatTile label="Received" value={isLoading ? "—" : format(summary.received_amount ?? 0)} icon={Banknote} tone="bg-emerald-100 text-emerald-700" />
        <StatTile label="Still to Receive" value={isLoading ? "—" : format(summary.pending_amount ?? 0)} icon={Clock} tone="bg-amber-100 text-amber-700" />
      </div>

      <ServerDataTable
        endpoint="/vendor/earnings/bookings"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="created_at"
        defaultSortOrder="desc"
        filters={{ from: from || undefined, to: to || undefined }}
      />
    </HomePageWrapper>
  );
}
