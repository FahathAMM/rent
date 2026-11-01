"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { Home, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

const ACTION_STATUS_OPTIONS = [
  { value: "reviewing", label: "Mark as reviewing" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismiss" },
];

function typeLabel(reportableType) {
  return reportableType?.split("\\").pop() ?? reportableType;
}

function ActionDialog({ report, onOpenChange, onDone }) {
  const [form, setForm] = useState({ status: "", action_taken: "", internal_note: "" });

  const action = useMutation({
    mutationFn: () => platformService.reports.action(report.id, form),
    onSuccess: () => { onDone(); toast.success("Report updated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to update report"),
  });

  return (
    <Dialog open={!!report} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Action Report #{report?.id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SelectInput label="Status" required options={ACTION_STATUS_OPTIONS} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          <TextInput label="Action taken (optional)" value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} />
          <TextareaInput label="Internal note (optional)" rows={3} value={form.internal_note} onChange={(e) => setForm({ ...form, internal_note: e.target.value })} />
        </div>
        <DialogFooter>
          <Button onClick={() => action.mutate()} disabled={!form.status || action.isPending}>
            {action.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AbuseReportsPage() {
  const [status, setStatus] = useState("");
  const [acting, setActing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = () => [
    {
      accessorKey: "report", header: "Report", style: { width: "34%" },
      cell: (row) => (
        <div className="py-1">
          <p className="font-medium">{typeLabel(row.reportable_type)} #{row.reportable_id}</p>
          <p className="text-[10px] capitalize text-muted-foreground">{row.reason?.replace(/_/g, " ")}</p>
          {row.description && <p className="truncate text-[10px] text-muted-foreground">{row.description}</p>}
        </div>
      ),
    },
    { accessorKey: "reporter", header: "Reported by", cell: (row) => row.reported_by?.name ?? row.reporter_email ?? "Anonymous" },
    { accessorKey: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { accessorKey: "created_at", header: "Submitted", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.created_at)}</span> },
    {
      accessorKey: "actions", header: "",
      cell: (row) => <Button size="sm" className="h-6 px-2 text-xs" onClick={() => setActing(row)}>Action</Button>,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Abuse Reports" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/abuse-reports"
          columns={columns}
          breadcrumb={[]}
          searchable={false}
          filters={{ status: status || undefined }}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        </ServerDataTable>
      </HomePageWrapper>

      <ActionDialog
        report={acting}
        onOpenChange={(v) => !v && setActing(null)}
        onDone={() => { setRefreshKey((k) => k + 1); setActing(null); }}
      />
    </div>
  );
}
