"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformReportService } from "@/services/platformReportService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { ChevronLeft, ChevronRight, Home, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
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
    mutationFn: () => platformReportService.action(report.id, form),
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
  const qc = useQueryClient();
  const [status, setStatus] = useState("new");
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-abuse-reports", status, page],
    queryFn: () => platformReportService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const columns = [
    {
      key: "report", header: "Report",
      render: (row) => (
        <div className="max-w-xs">
          <p className="text-sm font-medium">{typeLabel(row.reportable_type)} #{row.reportable_id}</p>
          <p className="text-xs text-muted-foreground capitalize">{row.reason.replace("_", " ")}</p>
          {row.description && <p className="truncate text-xs text-muted-foreground">{row.description}</p>}
        </div>
      ),
    },
    { key: "reporter", header: "Reported by", render: (row) => row.reported_by?.name ?? row.reporter_email ?? "Anonymous" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created_at", header: "Submitted", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button size="sm" onClick={() => setActing(row)}>Action</Button>,
    },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Abuse Reports" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Abuse Reports" description="User-submitted reports of fraud, fake listings, or other abuse." />

        <div className="mb-4 w-56">
          <SelectInput label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
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

      <ActionDialog
        report={acting}
        onOpenChange={(v) => !v && setActing(null)}
        onDone={() => { qc.invalidateQueries({ queryKey: ["platform-abuse-reports"] }); setActing(null); }}
      />
    </div>
  );
}
