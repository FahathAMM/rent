"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { vendorEarningsService } from "@/services/vendorEarningsService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wallet, Percent, Banknote, Clock, Home } from "lucide-react";

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

export default function EarningsPage() {
  const { format } = useCurrencyFormat();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-earnings", from, to],
    queryFn: () => vendorEarningsService.summary({ from: from || undefined, to: to || undefined }).then((r) => r.data.data),
  });

  const summary = data?.summary ?? {};
  const recent = data?.recent ?? [];

  const columns = [
    { key: "booking_reference", header: "Booking", render: (row) => row.booking?.booking_reference ?? "—" },
    { key: "gross_rental_amount", header: "Gross", render: (row) => format(row.gross_rental_amount) },
    { key: "commission_amount", header: "Commission", render: (row) => format(row.commission_amount) },
    { key: "owner_payable_amount", header: "Your Payout", render: (row) => format(row.owner_payable_amount) },
    { key: "settlement_status", header: "Status", render: (row) => <StatusBadge status={row.settlement_status} /> },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Earnings" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Earnings" description="Revenue, commission and payout totals, booking by booking." />

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

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Gross Rental Revenue" value={isLoading ? "—" : format(summary.gross_rental_amount ?? 0)} icon={Wallet} tone="bg-blue-100 text-blue-700" />
        <StatTile label="Platform Commission" value={isLoading ? "—" : format(summary.commission_amount ?? 0)} icon={Percent} tone="bg-violet-100 text-violet-700" />
        <StatTile label="Paid Out" value={isLoading ? "—" : format(summary.paid_amount ?? 0)} icon={Banknote} tone="bg-emerald-100 text-emerald-700" />
        <StatTile label="Pending Payout" value={isLoading ? "—" : format(summary.pending_amount ?? 0)} icon={Clock} tone="bg-amber-100 text-amber-700" />
      </div>

      <DataTable columns={columns} data={recent} loading={isLoading} />
    </HomePageWrapper>
  );
}
