"use client";

import { useState } from "react";
import Link from "next/link";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Eye, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "awaiting_info", label: "Awaiting info" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/** Customer vs. owner disagreements raised against a booking. */
export default function PlatformDisputesPage() {
  const [status, setStatus] = useState("");

  const columns = () => [
    {
      accessorKey: "dispute", header: "Dispute", style: { width: "30%" },
      cell: (row) => (
        <Link href={`/platform/disputes/${row.dispute_reference}`} className="block py-1 hover:underline">
          <p className="truncate font-medium">{row.subject}</p>
          <p className="truncate text-[10px] text-muted-foreground">{row.dispute_reference} · {row.booking?.booking_reference}</p>
        </Link>
      ),
    },
    { accessorKey: "category", header: "Category", cell: (row) => <span className="capitalize">{row.category?.replace(/_/g, " ")}</span> },
    { accessorKey: "priority", header: "Priority", cell: (row) => <span className="capitalize">{row.priority}</span> },
    { accessorKey: "assigned_to", header: "Assigned to", cell: (row) => row.assigned_to?.name ?? "—" },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "created_at", header: "Raised", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "",
      cell: (row) => <ActionButton href={`/platform/disputes/${row.dispute_reference}`} icon={Eye} label="View" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Disputes" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        api={platformApi}
        endpoint="/platform/disputes"
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
