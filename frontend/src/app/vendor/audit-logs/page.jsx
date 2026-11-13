"use client";

import { useState } from "react";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Eye, Home } from "lucide-react";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { formatDateTime } from "@/lib/utils";

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

export default function AuditLogsPage() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [detail, setDetail] = useState(null);

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
        ) : row.customer ? (
          <div>
            <p className="font-medium">
              {row.customer.name}{" "}
              <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">Customer</Badge>
            </p>
            <p className="text-[10px] text-muted-foreground">{row.customer.email}</p>
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
      accessorKey: "actions",
      header: "",
      class: "w-12",
      cell: (row) => (
        <ActionButton onClick={() => setDetail(row)} icon={Eye} label="View details" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Settings" },
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
          filters={{
            date_from: dateRange.from || undefined,
            date_to: dateRange.to || undefined,
          }}
        >
          <DateRangePicker placeholder="Date range" className="w-full sm:w-64" value={dateRange} onChange={setDateRange} />
        </ServerDataTable>
      </HomePageWrapper>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="space-y-2 px-5 pt-5 pb-4 text-left">
            <div className="flex items-center gap-2">
              <ActionBadge action={detail?.action} />
              <span className="text-xs font-medium text-muted-foreground">{detail?.form}</span>
              {detail?.record_id != null && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">#{detail.record_id}</span>
              )}
            </div>
            <DialogTitle className="text-base leading-snug">
              {detail?.record || `${detail?.form ?? "Record"} ${detail?.record_id ?? ""}`.trim()}
            </DialogTitle>
            <DialogDescription className="sr-only">Audit log entry details</DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
            <Meta label="Performed by">
              <Actor row={detail} />
            </Meta>
            <Meta label="Date & Time">
              <span className="font-medium">{formatDateTime(detail?.created_at)}</span>
            </Meta>
          </div>

          <Separator />

          <div className="px-5 py-4">
            <ChangeTable before={detail?.before} after={detail?.after} action={detail?.action} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, children }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="min-w-0 truncate">{children}</div>
    </div>
  );
}

function Actor({ row }) {
  const who = row?.user ?? row?.customer;
  if (!who) return <span className="italic text-muted-foreground">System</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">
        {who.name}
        {row?.customer && !row?.user && (
          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">Customer</Badge>
        )}
      </p>
      <p className="truncate text-[11px] text-muted-foreground">{who.email}</p>
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanize(key) {
  return key.replace(/_id$/, " ID").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Field-by-field diff of the audit row's before/after snapshots. Creates
 * only have `after`, deletes only `before`; edits list the keys from both
 * and highlight the ones that actually changed.
 */
function ChangeTable({ before, after, action }) {
  const hasBefore = before && Object.keys(before).length > 0;
  const hasAfter = after && Object.keys(after).length > 0;

  if (!hasBefore && !hasAfter) {
    return <p className="text-center text-xs italic text-muted-foreground">No field changes were recorded for this entry.</p>;
  }

  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const singleColumn = !hasBefore || !hasAfter;
  const singleLabel = hasAfter ? (action === "create" ? "Value" : "After") : "Before";

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Changes <span className="normal-case tracking-normal">({keys.length} field{keys.length === 1 ? "" : "s"})</span>
      </p>
      <div className="max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 text-left text-[11px] text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Field</th>
              {singleColumn ? (
                <th className="px-2.5 py-1.5 font-medium">{singleLabel}</th>
              ) : (
                <>
                  <th className="px-2.5 py-1.5 font-medium">Before</th>
                  <th className="px-2.5 py-1.5 font-medium">After</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.map((key) => {
              const b = formatValue(before?.[key]);
              const a = formatValue(after?.[key]);
              const changed = !singleColumn && b !== a;
              return (
                <tr key={key} className={changed ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">{humanize(key)}</td>
                  {singleColumn ? (
                    <td className="break-all px-2.5 py-1.5 font-mono">{hasAfter ? a : b}</td>
                  ) : (
                    <>
                      <td className={`break-all px-2.5 py-1.5 font-mono ${changed ? "text-red-700 line-through decoration-red-300 dark:text-red-400" : "text-muted-foreground"}`}>{b}</td>
                      <td className={`break-all px-2.5 py-1.5 font-mono ${changed ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{a}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
