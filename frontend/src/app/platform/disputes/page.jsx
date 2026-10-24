"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformDisputeService } from "@/services/platformDisputeService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "awaiting_info", label: "Awaiting info" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function PlatformDisputesPage() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-disputes", status, page],
    queryFn: () => platformDisputeService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const columns = [
    {
      key: "dispute", header: "Dispute",
      render: (row) => (
        <Link href={`/platform/disputes/${row.dispute_reference}`} className="hover:underline">
          <p className="text-sm font-medium">{row.subject}</p>
          <p className="text-xs text-muted-foreground">{row.dispute_reference} · {row.booking?.booking_reference}</p>
        </Link>
      ),
    },
    { key: "category", header: "Category", render: (row) => <span className="capitalize">{row.category.replace("_", " ")}</span> },
    { key: "priority", header: "Priority", render: (row) => <span className="capitalize">{row.priority}</span> },
    { key: "assigned_to", header: "Assigned to", render: (row) => row.assigned_to?.name ?? "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created_at", header: "Raised", render: (row) => formatDateTime(row.created_at) },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Disputes" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Disputes" description="Customer vs. owner disagreements raised against a booking." />

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
