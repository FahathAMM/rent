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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { Activity, CalendarDays, CalendarRange, Eye, Home, TrendingUp, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

/** Public site visits — every public page someone opened (one row per visit). */
export default function PlatformVisitsPage() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [topPagesOpen, setTopPagesOpen] = useState(false);
  const [viewVisit, setViewVisit] = useState(null);

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
      cell: (row) => (
        <span className="block max-w-[220px] truncate font-mono text-xs" title={row.path ?? ""}>
          {row.path ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "customer_name",
      header: "Customer",
      cell: (row) =>
        row.customer_id ? (
          <span className="whitespace-nowrap text-xs">
            {row.customer_name}
            <span className="ml-1 text-muted-foreground">#{row.customer_id}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Guest</span>
        ),
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
    {
      accessorKey: "actions",
      class: "w-12",
      header: "",
      cell: (row) => (
        <ActionButton
          onClick={() => setViewVisit(row)}
          icon={Eye}
          label="View"
          className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400"
        />
      ),
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

      <ServerDataTable
        api={platformApi}
        endpoint="/platform/visits"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="created_at"
        defaultSortOrder="desc"
        filters={{ date_from: dateRange.from || undefined, date_to: dateRange.to || undefined }}
      >
        <DateRangePicker placeholder="Date range" className="w-full sm:w-60" value={dateRange} onChange={setDateRange} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs sm:w-auto"
          onClick={() => setTopPagesOpen(true)}
          disabled={!summary?.top_pages?.length}
        >
          <TrendingUp className="size-3.5" />
          Top pages
        </Button>
      </ServerDataTable>

      <Dialog open={topPagesOpen} onOpenChange={setTopPagesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Top pages (last 30 days)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Page</th>
                  <th className="w-20 px-3 py-2 text-right text-xs font-semibold">Visits</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_pages?.map((p) => (
                  <tr key={p.path ?? "-"} className="border-t">
                    <td className="truncate px-3 py-2 font-mono text-xs" title={p.path ?? ""}>
                      {p.path ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{p.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewVisit} onOpenChange={(open) => !open && setViewVisit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visit details</DialogTitle>
          </DialogHeader>
          {viewVisit && (
            <dl className="divide-y rounded-md border text-sm">
              <DetailRow label="Date & Time" value={formatDateTime(viewVisit.created_at)} />
              <DetailRow label="Page" value={viewVisit.path} mono />
              <DetailRow
                label="Customer"
                value={viewVisit.customer_id ? `${viewVisit.customer_name ?? "—"} #${viewVisit.customer_id}` : "Guest"}
              />
              <DetailRow label="City" value={viewVisit.city} />
              <DetailRow label="Country" value={viewVisit.country} />
              <DetailRow label="Timezone" value={viewVisit.timezone} />
              <DetailRow label="IP" value={viewVisit.ip} mono />
              <DetailRow label="ISP" value={viewVisit.isp} />
              <DetailRow label="Browser" value={viewVisit.user_agent} small />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </HomePageWrapper>
  );
}

function DetailRow({ label, value, mono, small }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`break-all ${mono ? "font-mono text-xs" : small ? "text-[11px] text-muted-foreground" : "text-xs"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Stat({ label, value, Icon }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          <p className="text-lg font-bold leading-tight">{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
