"use client";

import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useState } from "react";
import { platformService } from "@/services/platformService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { useMutation } from "@tanstack/react-query";
import { Eye, Home, RotateCcw, ShieldAlert, Ban } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

export default function PlatformCustomersPage() {
  const [status, setStatus] = useState("");
  const [actionTarget, setActionTarget] = useState(null); // { user, action: 'suspend'|'ban' }

  const [refreshKey, setRefreshKey] = useState(0);

  const invalidate = () => setRefreshKey((k) => k + 1);

  const suspend = useMutation({
    mutationFn: ({ id, reason }) => platformService.customers.suspend(id, reason),
    onSuccess: () => { invalidate(); toast.success("Account suspended"); setActionTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const ban = useMutation({
    mutationFn: ({ id, reason }) => platformService.customers.ban(id, reason),
    onSuccess: () => { invalidate(); toast.success("Account banned"); setActionTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const activate = useMutation({
    mutationFn: (id) => platformService.customers.activate(id),
    onSuccess: () => { invalidate(); toast.success("Account activated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const columns = () => [
    {
      accessorKey: "name", header: "Name",
      cell: (row) => (
        <Link href={`/platform/customers/${row.id}`} className="group block">
          <p className="text-sm font-medium group-hover:text-primary group-hover:underline">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email || row.phone}</p>
        </Link>
      ),
    },
    { accessorKey: "phone", header: "Phone", cell: (row) => row.phone || "—" },
    { accessorKey: "bookings_count", header: "Bookings", cell: (row) => row.bookings_count },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "created_at", header: "Joined", cell: (row) => formatDateTime(row.created_at) },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <ActionButton href={`/platform/customers/${row.id}`} icon={Eye} label="View customer" className="text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400" />
          {row.status !== "active" && (
            <ActionButton onClick={() => activate.mutate(row.id)} icon={RotateCcw} label="Activate" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" disabled={activate.isPending} />
          )}
          {row.status !== "suspended" && (
            <ActionButton onClick={() => setActionTarget({ user: row, action: "suspend" })} icon={ShieldAlert} label="Suspend" className="text-amber-600 border-amber-300 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-400" />
          )}
          {row.status !== "banned" && (
            <ActionButton onClick={() => setActionTarget({ user: row, action: "ban" })} icon={Ban} label="Ban" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Customers" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/customers"
          columns={columns}
          breadcrumb={[]}
          filters={{ status: status || undefined }}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        </ServerDataTable>
      </HomePageWrapper>

      <ReasonDialog
        open={actionTarget?.action === "suspend"}
        onOpenChange={(v) => !v && setActionTarget(null)}
        title="Suspend Account"
        description="The account's existing sessions are logged out immediately."
        confirmText="Suspend"
        loading={suspend.isPending}
        onConfirm={(reason) => suspend.mutate({ id: actionTarget.user.id, reason })}
      />
      <ReasonDialog
        open={actionTarget?.action === "ban"}
        onOpenChange={(v) => !v && setActionTarget(null)}
        title="Ban Account"
        description="A ban is more severe than a suspension and should be reserved for confirmed abuse or fraud."
        confirmText="Ban"
        loading={ban.isPending}
        onConfirm={(reason) => ban.mutate({ id: actionTarget.user.id, reason })}
      />
    </div>
  );
}
