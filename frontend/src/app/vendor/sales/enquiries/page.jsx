"use client";

import { useState } from "react";
import Link from "next/link";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { inboxTime } from "@/lib/chat";
import { cn, formatDateTime } from "@/lib/utils";
import { Car, Eye, Home, MailOpen } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new", label: "Waiting for you" },
  { value: "replied", label: "Replied" },
  { value: "accepted", label: "Sold to this buyer" },
  { value: "closed", label: "Closed" },
];

export default function SaleEnquiriesPage() {
  const [status, setStatus] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const columns = () => [
    {
      accessorKey: "reference",
      header: "Enquiry",
      cell: (row) => {
        const unread = row.unread_count > 0;
        const last = row.last_message;
        const preview = last ? `${last.sender_type === "shop" ? "You: " : ""}${last.body}` : "";
        return (
          <Link href={`/vendor/sales/enquiries/${row.reference}`} className="flex min-w-[260px] max-w-md items-center gap-3">
            <div className="size-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
              {row.vehicle?.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={row.vehicle.image_url} alt="" className="size-full object-cover" />
                : <div className="flex size-full items-center justify-center text-muted-foreground"><Car className="h-5 w-5" /></div>}
            </div>
            <div className="min-w-0">
              <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{row.vehicle?.title ?? "—"}</p>
              {preview
                ? <p className={cn("truncate text-xs", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{preview}</p>
                : <p className="text-xs text-muted-foreground">{row.reference}</p>}
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "customer",
      header: "Buyer",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer?.name ?? "—"}</p>
          {row.customer?.phone && <p className="text-xs text-muted-foreground">{row.customer.phone}</p>}
        </div>
      ),
    },
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
    {
      accessorKey: "last_message_at",
      header: "Last message",
      cell: (row) => (
        <span className={cn("whitespace-nowrap text-sm", row.unread_count > 0 && "font-semibold text-primary")} title={formatDateTime(row.last_message_at)}>
          {inboxTime(row.last_message?.created_at ?? row.last_message_at)}
        </span>
      ),
    },
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
      <ServerDataTable
        endpoint="/vendor/sales/enquiries"
        columns={columns}
        breadcrumb={[]}
        filters={{ status: status || undefined, unread: unreadOnly ? 1 : undefined }}
      >
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All enquiries" />
        <Button
          type="button"
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setUnreadOnly((v) => !v)}
          aria-pressed={unreadOnly}
        >
          <MailOpen className="h-3.5 w-3.5" />Unread only
        </Button>
      </ServerDataTable>
    </HomePageWrapper>
  );
}
