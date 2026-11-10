"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Eye, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ALL_STATUSES = "all";

const STATUS_OPTIONS = [
  { value: ALL_STATUSES, label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled_by_customer", label: "Cancelled by customer" },
  { value: "cancelled_by_owner", label: "Cancelled by me" },
  { value: "no_show", label: "No-show" },
];

/** The shop's booking inbox — each booking opens on its own page (/vendor/bookings/[reference]) to accept, hand over, return. */
export default function VendorBookingsPage() {
  const { format } = useCurrencyFormat();
  const [status, setStatus] = useState(ALL_STATUSES);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "booking_reference",
      class: "w-[30%]",
      header: () => <SortableHeader label="Booking" column="booking_reference" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (
        <Link href={`/vendor/bookings/${row.booking_reference}`} className="block hover:underline">
          <p className="font-medium">{row.booking_reference}</p>
          <p className="text-[11px] text-muted-foreground">{row.vehicle?.title}</p>
        </Link>
      ),
    },
    { accessorKey: "customer", header: "Customer", cell: (row) => row.customer?.name ?? "—" },
    {
      accessorKey: "pickup_at",
      header: () => <SortableHeader label="Pickup" column="pickup_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => formatDateTime(row.pickup_at),
    },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { accessorKey: "total_payable", header: "Total", cell: (row) => format(row.pricing?.total_payable) },
    {
      accessorKey: "actions",
      class: "w-16",
      header: "",
      cell: (row) => <ActionButton href={`/vendor/bookings/${row.booking_reference}`} icon={Eye} label="Review" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Bookings" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        endpoint="/vendor/bookings"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="created_at"
        defaultSortOrder="desc"
        filters={{
          status: status === ALL_STATUSES ? undefined : status,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }}
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangePicker placeholder="Pickup date" className="w-full sm:w-60" value={dateRange} onChange={setDateRange} />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
