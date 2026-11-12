"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import platformApi from "@/lib/platformAxios";
import { platformService } from "@/services/platformService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { Activity, CalendarDays, CalendarRange, Eye, Home, TrendingUp, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

// Public site visits (guests/customers) and vendor app visits (owners/staff) share one log.
const TYPE_OPTIONS = [
  { value: "public_visit", label: "Public site" },
  { value: "vendor_visit", label: "Vendor app" },
];

/** Who made the visit: the customer, the vendor member (with their shop), or a guest. */
function visitor(row) {
  if (row.type === "vendor_visit") {
    return row.user_id
      ? { name: row.user_name, id: row.user_id, meta: row.shop_name ?? null }
      : null;
  }
  return row.customer_id ? { name: row.customer_name, id: row.customer_id, meta: null } : null;
}

/** Page visits — every public page or vendor app page someone opened (one row per visit). */
export default function PlatformVisitsPage() {
  const [type, setType] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [topPagesOpen, setTopPagesOpen] = useState(false);
  const [viewVisit, setViewVisit] = useState(null);

  const { data: summary } = useQuery({
    queryKey: ["platform-visits-summary", type],
    queryFn: () => platformService.visits.summary({ type: type || undefined }).then((r) => r.data.data),
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "created_at",
      header: () => <SortableHeader label="Date & Time" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.created_at)}</span>,
    },
    {
      accessorKey: "type",
      header: () => <SortableHeader label="Source" column="type" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (
        <Badge variant={row.type === "vendor_visit" ? "info" : "secondary"} className="whitespace-nowrap">
          {row.type === "vendor_visit" ? "Vendor app" : "Public site"}
        </Badge>
      ),
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
      accessorKey: "visitor",
      header: "Visitor",
      cell: (row) => {
        const who = visitor(row);
        if (!who) return <span className="text-xs text-muted-foreground">Guest</span>;
        return (
          <div className="whitespace-nowrap text-xs">
            <span>
              {who.name}
              <span className="ml-1 text-muted-foreground">#{who.id}</span>
            </span>
            <p className="text-[10px] text-muted-foreground">
              {row.type === "vendor_visit" ? `Vendor${who.meta ? ` · ${who.meta}` : ""}` : "Customer"}
            </p>
          </div>
        );
      },
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
    { label: "Visits" },
  ];

  const viewWho = viewVisit ? visitor(viewVisit) : null;

  // Top pages split by source (public site / vendor app); just the filtered one when Source is set.
  const topPageGroups = TYPE_OPTIONS
    .filter((o) => !type || o.value === type)
    .map((o) => ({ ...o, pages: summary?.top_pages_by_type?.[o.value] ?? [] }));

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
        filters={{
          type: type || undefined,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }}
      >
        <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All visits" className="sm:w-36" />
        <DateRangePicker placeholder="Date range" className="w-full sm:w-60" value={dateRange} onChange={setDateRange} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs sm:w-auto"
          onClick={() => setTopPagesOpen(true)}
          disabled={!topPageGroups.some((g) => g.pages.length)}
        >
          <TrendingUp className="size-3.5" />
          Top pages
        </Button>
      </ServerDataTable>

      <Dialog open={topPagesOpen} onOpenChange={setTopPagesOpen}>
        <DialogContent className={topPageGroups.length > 1 ? "max-w-3xl" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>Top pages (last 30 days)</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto sm:flex-row sm:items-start">
            {topPageGroups.map(({ value, label, pages }) => (
              <section key={value} className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant={value === "vendor_visit" ? "info" : "secondary"}>{label}</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {pages.length ? `Top ${pages.length}` : "No visits"}
                  </span>
                </div>
                {pages.length > 0 && (
                  <div className="rounded-md border">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Page</th>
                          <th className="w-20 px-3 py-2 text-right text-xs font-semibold">Visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pages.map((p) => (
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
                )}
              </section>
            ))}
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
              <DetailRow label="Source" value={viewVisit.type === "vendor_visit" ? "Vendor app" : "Public site"} />
              <DetailRow label="Page" value={viewVisit.path} mono />
              {viewVisit.type === "vendor_visit" ? (
                <>
                  <DetailRow label="Vendor user" value={viewWho ? `${viewWho.name ?? "—"} #${viewWho.id}` : "Guest"} />
                  <DetailRow label="Shop" value={viewVisit.shop_id ? `${viewVisit.shop_name ?? "—"} #${viewVisit.shop_id}` : viewVisit.shop_name} />
                </>
              ) : (
                <DetailRow label="Customer" value={viewWho ? `${viewWho.name ?? "—"} #${viewWho.id}` : "Guest"} />
              )}
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
