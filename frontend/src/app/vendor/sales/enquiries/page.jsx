"use client";

import { useState } from "react";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { Eye, Home } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new", label: "Waiting for you" },
  { value: "replied", label: "Replied" },
  { value: "accepted", label: "Sold to this buyer" },
  { value: "closed", label: "Closed" },
];

export default function SaleEnquiriesPage() {
  const [status, setStatus] = useState("");

  const columns = () => [
    {
      accessorKey: "reference",
      header: "Enquiry",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.vehicle?.title ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.reference}</p>
        </div>
      ),
    },
    { accessorKey: "customer", header: "Buyer", cell: (row) => row.customer?.name ?? "—" },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{row.unread_count} new</span>}
        </div>
      ),
    },
    { accessorKey: "last_message_at", header: "Last message", cell: (row) => formatDateTime(row.last_message_at) },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => <ActionButton href={`/vendor/sales/enquiries/${row.reference}`} icon={Eye} label="Open enquiry" className="text-sky-700 border-sky-300 hover:text-sky-800 hover:bg-sky-50 hover:border-sky-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Enquiries" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable endpoint="/vendor/sales/enquiries" columns={columns} breadcrumb={[]} filters={{ status: status || undefined }}>
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All enquiries" />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
