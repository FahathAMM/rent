"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import platformApi from "@/lib/platformAxios";
import { platformService } from "@/services/platformService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, CalendarDays, CalendarRange, Home, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

/** Public site visits — every public page someone opened (one row per visit). */
export default function PlatformVisitsPage() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const { data: summary } = useQuery({
    queryKey: ["platform-visits-summary"],
    queryFn: () => platformService.visits.summary().then((r) => r.data.data),
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "created_at",
      header: () => <SortableHeader label="Date & Time" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.created_at)}</span>,
    },
    {
      accessorKey: "path",
      header: () => <SortableHeader label="Page" column="path" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="font-mono text-xs">{row.path ?? "—"}</span>,
    },
    {
      accessorKey: "country",
      header: () => <SortableHeader label="Location" column="country" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => [row.city, row.country].filter(Boolean).join(", ") || "—",
    },
    { accessorKey: "ip", header: "IP", cell: (row) => <span className="text-xs">{row.ip ?? "—"}</span> },
    { accessorKey: "isp", header: "ISP", cell: (row) => <span className="text-xs">{row.isp ?? "—"}</span> },
    {
      accessorKey: "user_agent",
      header: "Browser",
      cell: (row) => <span className="line-clamp-1 max-w-xs text-[11px] text-muted-foreground" title={row.user_agent}>{row.user_agent ?? "—"}</span>,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Public Visits" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 lg:grid-cols-4">
        <Stat label="Today" value={summary?.today} Icon={Activity} />
        <Stat label="Unique visitors today" value={summary?.unique_today} Icon={Users} />
        <Stat label="Last 7 days" value={summary?.last_7_days} Icon={CalendarDays} />
        <Stat label="Last 30 days" value={summary?.last_30_days} Icon={CalendarRange} />
      </div>

      {summary?.top_pages?.length > 0 && (
        <div className="px-4">
          <p className="mb-2 text-sm font-semibold">Top pages (last 30 days)</p>
          <div className="flex flex-wrap gap-2">
            {summary.top_pages.map((p) => (
              <span key={p.path ?? "-"} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">
                <span className="font-mono">{p.path ?? "—"}</span>
                <span className="ml-2 font-semibold">{p.visits}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <ServerDataTable
        api={platformApi}
        endpoint="/platform/visits"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="created_at"
        defaultSortOrder="desc"
        filters={{ date_from: dateRange.from || undefined, date_to: dateRange.to || undefined }}
      >
        <DateRangePicker placeholder="Date range" className="w-full sm:w-44" value={dateRange} onChange={setDateRange} />
      </ServerDataTable>
    </HomePageWrapper>
  );
}

function Stat({ label, value, Icon }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
