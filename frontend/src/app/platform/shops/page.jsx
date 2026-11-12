"use client";

import { useState } from "react";
import Link from "next/link";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { Eye, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const VERIFICATION_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "unverified", label: "Unverified" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default function PlatformShopsPage() {
  const [verificationStatus, setVerificationStatus] = useState("");

  const columns = () => [
    {
      accessorKey: "name", header: "Shop",
      cell: (row) => (
        <Link href={`/platform/shops/${row.id}`} className="block hover:underline">
          <p className="font-medium">{row.name}</p>
          <p className="text-[10px] text-muted-foreground">{row.owner?.email}</p>
        </Link>
      ),
    },
    { accessorKey: "city", header: "Location", cell: (row) => [row.city, row.district].filter(Boolean).join(", ") || "—" },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "verification_status", header: "Verification", cell: (row) => <StatusBadge status={row.verification_status} /> },
    { accessorKey: "created_at", header: "Registered", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => <ActionButton href={`/platform/shops/${row.id}`} icon={Eye} label="Review" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Shop Verification" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        api={platformApi}
        endpoint="/platform/shops"
        columns={columns}
        breadcrumb={[]}
        filters={{ verification_status: verificationStatus || undefined }}
      >
        <FilterSelect value={verificationStatus} onChange={setVerificationStatus} options={VERIFICATION_OPTIONS} allLabel="All verification states" />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
