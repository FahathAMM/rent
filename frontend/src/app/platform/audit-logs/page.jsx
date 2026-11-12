"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import platformApi from "@/lib/platformAxios";
import { platformService } from "@/services/platformService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { Eye, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ACTION_VARIANTS = { create: "success", edit: "info", update: "info", view: "secondary", delete: "destructive", suspend: "destructive", activate: "success", impersonate_start: "warning", impersonate_stop: "secondary" };
const EVENTS = ["create", "update", "delete", "suspend", "activate", "impersonate_start", "impersonate_stop"];

export default function PlatformAuditLogsPage() {
  const searchParams = useSearchParams();
  const [shopId, setShopId] = useState(searchParams.get("shop_id") ?? "");
  const [userId, setUserId] = useState("");
  const [event, setEvent] = useState("");
  const [model, setModel] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [detail, setDetail] = useState(null);

  const { data: shops } = useQuery({
    queryKey: ["platform-shops-lite"],
    queryFn: () => platformService.shops.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });

  // A shop's users (owner + staff) come back as `members` on the shop detail.
  const { data: shopUsers } = useQuery({
    queryKey: ["platform-shop-users", shopId],
    queryFn: () => platformService.shops.getOne(shopId).then((r) => r.data.data.members),
    enabled: !!shopId,
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "created_at",
      header: () => (
        <SortableHeader label="Date & Time" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => <span className="text-xs whitespace-nowrap">{formatDateTime(row.created_at)}</span>,
    },
    {
      accessorKey: "shop",
      header: "Shop",
      cell: (row) => row.shop?.name ?? "—",
    },
    {
      accessorKey: "actor",
      header: "Actor",
      cell: (row) =>
        row.user ? (
          <div>
            <p className="font-medium">{row.user.name}</p>
            <p className="text-[10px] text-muted-foreground">{row.user.email}</p>
          </div>
        ) : row.customer ? (
          <div>
            <p className="font-medium">{row.customer.name}</p>
            <p className="text-[10px] text-muted-foreground">Customer · {row.customer.email}</p>
          </div>
        ) : row.system_admin ? (
          <div>
            <p className="font-medium">{row.system_admin.name}</p>
            <p className="text-[10px] text-muted-foreground">Platform Admin</p>
          </div>
        ) : (
          <span className="italic text-muted-foreground text-xs">System</span>
        ),
    },
    {
      accessorKey: "action",
      header: () => (
        <SortableHeader label="Event" column="action" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => <Badge variant={ACTION_VARIANTS[row.action] ?? "outline"} className="capitalize">{row.action.replace("_", " ")}</Badge>,
    },
    {
      accessorKey: "form",
      header: () => (
        <SortableHeader label="Model" column="form" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
    },
    {
      accessorKey: "record",
      header: "Record",
      cell: (row) => row.record || "—",
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <ActionButton onClick={() => setDetail(row)} icon={Eye} label="View details" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Audit Logs" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          api={platformApi}
          endpoint="/platform/audit-logs"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          filters={{
            shop_id: shopId || undefined,
            user_id: userId || undefined,
            event: event || undefined,
            model: model || undefined,
            date_from: dateRange.from || undefined,
            date_to: dateRange.to || undefined,
          }}
        >
          <Select value={shopId || "all"} onValueChange={(v) => { setShopId(v === "all" ? "" : v); setUserId(""); }}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-40"><SelectValue placeholder="Shop" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shops</SelectItem>
              {(shops ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={userId || "all"} onValueChange={(v) => setUserId(v === "all" ? "" : v)} disabled={!shopId}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-36"><SelectValue placeholder="User" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {(shopUsers ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={event || "all"} onValueChange={(v) => setEvent(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-36"><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {EVENTS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input placeholder="Model (e.g. Vehicle)" className="h-8 w-full text-sm sm:w-36" value={model} onChange={(e) => setModel(e.target.value)} />

          <DateRangePicker placeholder="Date range" className="w-full sm:w-44" value={dateRange} onChange={setDateRange} />
        </ServerDataTable>
      </HomePageWrapper>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detail?.user?.name ?? detail?.customer?.name ?? detail?.system_admin?.name ?? "System"} {detail?.action?.replace("_", " ")}d {detail?.form}
              {detail?.record ? ` "${detail.record}"` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Row label="Shop" value={detail?.shop?.name ?? "—"} />
            <Row label="Date" value={formatDateTime(detail?.created_at)} />
            <Row label="IP Address" value={detail?.ip ?? "—"} />
            <Row label="User Agent" value={detail?.browser ?? "—"} />
            {detail?.old_values && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Old Values</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px]">{JSON.stringify(detail.old_values, null, 2)}</pre>
              </div>
            )}
            {detail?.new_values && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">New Values</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px]">{JSON.stringify(detail.new_values, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
