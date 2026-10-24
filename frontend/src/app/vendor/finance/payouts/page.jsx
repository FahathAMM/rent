"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { vendorPayoutService } from "@/services/vendorPayoutService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";

export default function PayoutsPage() {
  const { format } = useCurrencyFormat();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-payouts", page],
    queryFn: () => vendorPayoutService.getAll({ page }).then((r) => r.data.record),
  });

  const columns = [
    { key: "payout_reference", header: "Payout" },
    { key: "period", header: "Period", render: (row) => `${row.period_start} → ${row.period_end}` },
    { key: "booking_count", header: "Bookings" },
    { key: "net_amount", header: "Net Amount", render: (row) => format(row.net_amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "paid_at", header: "Paid", render: (row) => row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "—" },
  ];

  const records = data?.data ?? [];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Payouts" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Payouts" description="Your settlement history — built and paid by the platform's finance team." />

        <DataTable columns={columns} data={records} loading={isLoading} />

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.current_page} of {data.last_page} — {data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </HomePageWrapper>
    </div>
  );
}
