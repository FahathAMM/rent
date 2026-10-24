"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformPaymentService } from "@/services/platformPaymentService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "initiated", label: "Initiated" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "chargeback", label: "Chargeback" },
];

export default function PlatformPaymentsPage() {
  const { format } = useCurrencyFormat();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-payments", status, page],
    queryFn: () => platformPaymentService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const columns = [
    { key: "payment_reference", header: "Reference", render: (row) => <span className="font-mono text-xs">{row.payment_reference}</span> },
    { key: "booking", header: "Booking", render: (row) => row.booking?.booking_reference ?? "—" },
    { key: "gateway", header: "Gateway", render: (row) => <span className="capitalize">{row.gateway}</span> },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type}</span> },
    { key: "amount", header: "Amount", render: (row) => format(row.amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "paid_at", header: "Paid at", render: (row) => row.paid_at ? formatDateTime(row.paid_at) : "—" },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Payments" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Payments" description="Read-only — written only by PaymentService and the PayHere webhook handler." />

      <div className="mb-4 w-56">
        <SelectInput label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
      </div>

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
    </PageWrapper>
  );
}
