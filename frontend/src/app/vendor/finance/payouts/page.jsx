"use client";

import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Home } from "lucide-react";

export default function PayoutsPage() {
  const { format } = useCurrencyFormat();

  const columns = ({ sortField, sortOrder, handleSort }) => [
    { accessorKey: "payout_reference", header: "Payout" },
    {
      accessorKey: "period_start",
      header: () => <SortableHeader label="Period" column="period_start" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => `${row.period_start} → ${row.period_end}`,
    },
    { accessorKey: "booking_count", header: "Bookings" },
    {
      accessorKey: "net_amount",
      header: () => <SortableHeader label="Net Amount" column="net_amount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => format(row.net_amount),
    },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      accessorKey: "paid_at",
      header: () => <SortableHeader label="Paid" column="paid_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "—",
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Payouts" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          endpoint="/vendor/payouts"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
        />
      </HomePageWrapper>
    </div>
  );
}
