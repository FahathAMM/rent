"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platformCustomerService } from "@/services/platformCustomerService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

export default function PlatformCustomersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState(null); // { user, action: 'suspend'|'ban' }

  const { data, isLoading } = useQuery({
    queryKey: ["platform-customers", status, search, page],
    queryFn: () => platformCustomerService.getAll({ status: status || undefined, search: search || undefined, page }).then((r) => r.data.record),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-customers"] });

  const suspend = useMutation({
    mutationFn: ({ id, reason }) => platformCustomerService.suspend(id, reason),
    onSuccess: () => { invalidate(); toast.success("Account suspended"); setActionTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const ban = useMutation({
    mutationFn: ({ id, reason }) => platformCustomerService.ban(id, reason),
    onSuccess: () => { invalidate(); toast.success("Account banned"); setActionTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const activate = useMutation({
    mutationFn: (id) => platformCustomerService.activate(id),
    onSuccess: () => { invalidate(); toast.success("Account activated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const columns = [
    {
      key: "name", header: "Name",
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: "roles", header: "Roles", render: (row) => row.roles?.map((r) => r.name).join(", ") },
    { key: "bookings_count", header: "Bookings", render: (row) => row.bookings_count },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created_at", header: "Joined", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.status !== "active" && (
            <Button size="sm" onClick={() => activate.mutate(row.id)} disabled={activate.isPending}>Activate</Button>
          )}
          {row.status !== "suspended" && (
            <Button size="sm" variant="outline" onClick={() => setActionTarget({ user: row, action: "suspend" })}>Suspend</Button>
          )}
          {row.status !== "banned" && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setActionTarget({ user: row, action: "ban" })}>Ban</Button>
          )}
        </div>
      ),
    },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Customers" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Customers" description="Every marketplace account — customers, owners, and shop staff." />

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="w-56">
            <SelectInput label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
          <div className="w-64">
            <label className="text-sm font-medium">Search</label>
            <input
              className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
              placeholder="Name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <DataTable columns={columns} data={records} loading={isLoading} />

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.current_page} of {data.last_page} — {data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </PageWrapper>

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
