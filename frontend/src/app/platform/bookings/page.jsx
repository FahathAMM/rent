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
  { value: "pending", label: "Pending" },
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

  const columns = () => [
    {
      accessorKey: "booking_reference", header: "Reference",
      cell: (row) => <Link href={`/platform/bookings/${row.booking_reference}`} className="font-mono hover:underline">{row.booking_reference}</Link>,
    },
    { accessorKey: "vehicle", header: "Vehicle", cell: (row) => <span className="block truncate">{row.vehicle?.title}</span> },
    { accessorKey: "shop", header: "Shop", cell: (row) => <span className="block truncate">{row.shop?.name}</span> },
    { accessorKey: "customer", header: "Customer", cell: (row) => <span className="block truncate">{row.customer?.name}</span> },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "has_open_dispute", header: "Dispute", cell: (row) => row.has_open_dispute ? <StatusBadge status="flagged" /> : "—" },
    { accessorKey: "created_at", header: "Created", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "",
      cell: (row) => <ActionButton href={`/platform/bookings/${row.booking_reference}`} icon={Eye} label="View" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Bookings" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        api={platformApi}
        endpoint="/platform/bookings"
        columns={columns}
        breadcrumb={[]}
        filters={{ status: status || undefined }}
      >
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
