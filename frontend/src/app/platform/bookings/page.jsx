"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformBookingService } from "@/services/platformBookingService";
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
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled_by_customer", label: "Cancelled (customer)" },
  { value: "cancelled_by_owner", label: "Cancelled (owner)" },
  { value: "cancelled_by_admin", label: "Cancelled (admin)" },
  { value: "no_show", label: "No-show" },
];

export default function PlatformBookingsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-bookings", status, search, page],
    queryFn: () => platformBookingService.getAll({ status: status || undefined, search: search || undefined, page }).then((r) => r.data.record),
  });

  const columns = [
    {
      key: "booking_reference", header: "Reference",
      render: (row) => <Link href={`/platform/bookings/${row.booking_reference}`} className="font-mono text-xs hover:underline">{row.booking_reference}</Link>,
    },
    { key: "vehicle", header: "Vehicle", render: (row) => row.vehicle?.title },
    { key: "shop", header: "Shop", render: (row) => row.shop?.name },
    { key: "customer", header: "Customer", render: (row) => row.customer?.name },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "has_open_dispute", header: "Dispute", render: (row) => row.has_open_dispute ? <StatusBadge status="flagged" /> : "—" },
    { key: "created_at", header: "Created", render: (row) => formatDateTime(row.created_at) },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Bookings" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Bookings" description="Cross-shop booking oversight." />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-56">
          <SelectInput label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
        </div>
        <div className="w-64">
          <label className="text-sm font-medium">Search reference</label>
          <input
            className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            placeholder="BKG-..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
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
