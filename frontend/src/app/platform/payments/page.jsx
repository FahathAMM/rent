"use client";

import { useState } from "react";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "initiated", label: "Initiated" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "chargeback", label: "Chargeback" },
];

/** Read-only — payments are written only by PaymentService and the PayHere webhook handler. */
export default function PlatformPaymentsPage() {
  const { format } = useCurrencyFormat();
  const [status, setStatus] = useState("");

  const columns = () => [
    { accessorKey: "payment_reference", header: "Reference", cell: (row) => <span className="font-mono">{row.payment_reference}</span> },
    { accessorKey: "booking", header: "Booking", cell: (row) => row.booking?.booking_reference ?? "—" },
    { accessorKey: "method", header: "Method", cell: (row) => (row.method === "bank" ? "Bank transfer" : row.method === "cash" ? "Cash" : "—") },
    { accessorKey: "type", header: "Type", cell: (row) => <span className="capitalize">{String(row.type).replace(/_/g, " ")}</span> },
    { accessorKey: "credit", header: "Credit", cell: (row) => (Number(row.credit) > 0 ? <span className="text-emerald-600">{format(row.credit)}</span> : "—") },
    { accessorKey: "debit", header: "Debit", cell: (row) => (Number(row.debit) > 0 ? <span className="text-destructive">{format(row.debit)}</span> : "—") },
    { accessorKey: "balance", header: "Balance", cell: (row) => (row.balance != null ? <span className="font-medium">{format(row.balance)}</span> : "—") },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "paid_at", header: "Paid at", cell: (row) => row.paid_at ? <span className="whitespace-nowrap">{formatDateTime(row.paid_at)}</span> : "—" },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Payments" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        api={platformApi}
        endpoint="/platform/payments"
        columns={columns}
        breadcrumb={[]}
        searchable={false}
        filters={{ status: status || undefined }}
      >
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
