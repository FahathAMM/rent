"use client";

import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Badge } from "@/components/ui/badge";
import { Globe2, Monitor, Home } from "lucide-react";

const ACTION_VARIANTS = {
  create: "success",
  edit: "info",
  view: "secondary",
  delete: "destructive",
};

function ActionBadge({ action }) {
  return (
    <Badge variant={ACTION_VARIANTS[action] ?? "outline"} className="capitalize">
      {action}
    </Badge>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AuditLogsPage() {
  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "created_at",
      header: () => (
        <SortableHeader label="Date & Time" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => (
        <span className="text-xs whitespace-nowrap">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      accessorKey: "user",
      header: "User",
      cell: (row) =>
        row.user ? (
          <div>
            <p className="font-medium">{row.user.name}</p>
            <p className="text-[10px] text-muted-foreground">{row.user.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">System</span>
        ),
    },
    {
      accessorKey: "action",
      header: () => (
        <SortableHeader label="Action" column="action" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => <ActionBadge action={row.action} />,
    },
    {
      accessorKey: "form",
      header: () => (
        <SortableHeader label="Form" column="form" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
    },
    {
      accessorKey: "record_id",
      header: () => (
        <SortableHeader label="Record ID" column="record_id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => row.record_id ?? "—",
    },
    {
      accessorKey: "record",
      header: "Record",
      cell: (row) => row.record || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "ip",
      header: "IP",
      cell: (row) =>
        row.ip ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono">
            <Globe2 className="h-3 w-3 text-muted-foreground" />
            {row.ip}
          </span>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "browser",
      header: "Browser",
      cell: (row) =>
        row.browser ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <Monitor className="h-3 w-3 text-muted-foreground" />
            {row.browser}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Audit Logs" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          endpoint="/audit-logs"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
        />
      </HomePageWrapper>
    </div>
  );
}
