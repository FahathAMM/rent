"use client";

import { useState } from "react";
import Link from "next/link";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { Eye, Home, ImageOff, Star } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const MODERATION_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "flagged", label: "Flagged" },
];

const primaryImageUrl = (img) => (img?.attachment ? `/storage/${img.attachment.file_path}` : null);

export default function PlatformListingsPage() {
  const [moderationStatus, setModerationStatus] = useState("");

  const columns = () => [
    {
      accessorKey: "title", header: "Vehicle", style: { width: "28%" },
      cell: (row) => {
        const img = (row.images ?? [])[0];
        return (
          <Link href={`/platform/listings/${row.id}`} className="flex items-center gap-2 py-1 hover:underline">
            <div className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primaryImageUrl(img)} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{row.shop?.name}</p>
            </div>
          </Link>
        );
      },
    },
    { accessorKey: "category", header: "Category", cell: (row) => row.category?.name ?? "—" },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "moderation_status", header: "Moderation", cell: (row) => <StatusBadge status={row.moderation_status} /> },
    { accessorKey: "is_featured", header: "Featured", cell: (row) => row.is_featured ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : "—" },
    { accessorKey: "created_at", header: "Submitted", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "",
      cell: (row) => <ActionButton href={`/platform/listings/${row.id}`} icon={Eye} label="Review" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Listing Moderation" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable
        api={platformApi}
        endpoint="/platform/listings"
        columns={columns}
        breadcrumb={[]}
        filters={{ moderation_status: moderationStatus || undefined }}
      >
        <FilterSelect value={moderationStatus} onChange={setModerationStatus} options={MODERATION_OPTIONS} allLabel="All moderation states" />
      </ServerDataTable>
    </HomePageWrapper>
  );
}
