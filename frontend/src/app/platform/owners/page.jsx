"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformOwnerVerificationService } from "@/services/platformOwnerVerificationService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Home, FileText, Download } from "lucide-react";
import { formatDateTime, downloadBlob } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "draft", label: "Draft" },
  { value: "info_requested", label: "Info Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

export default function PlatformOwnersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'request-info' | 'suspend'

  const { data, isLoading } = useQuery({
    queryKey: ["platform-owner-applications", status, search, page],
    queryFn: () => platformOwnerVerificationService.getAll({ status: status || undefined, search: search || undefined, page }).then((r) => r.data.record),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["platform-owner-application", selected?.id],
    queryFn: () => platformOwnerVerificationService.getOne(selected.id).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-owner-applications"] });
    qc.invalidateQueries({ queryKey: ["platform-owner-application", selected?.id] });
  };

  const approve = useMutation({
    mutationFn: () => platformOwnerVerificationService.approve(selected.id),
    onSuccess: () => { invalidate(); toast.success("Application approved"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to approve"),
  });

  const reject = useMutation({
    mutationFn: (reason) => platformOwnerVerificationService.reject(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Application rejected"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const requestInfo = useMutation({
    mutationFn: (reason) => platformOwnerVerificationService.requestInfo(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Information requested"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to request info"),
  });

  const suspend = useMutation({
    mutationFn: (reason) => platformOwnerVerificationService.suspend(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Owner suspended"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to suspend"),
  });

  const handleDownload = async (verificationId, filename) => {
    try {
      const res = await platformOwnerVerificationService.downloadDocument(verificationId);
      downloadBlob(res.data, filename);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const columns = [
    {
      key: "full_name", header: "Applicant",
      render: (row) => (
        <div>
          <p className="font-medium">{row.full_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.user?.email}</p>
        </div>
      ),
    },
    { key: "nic_number", header: "NIC" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "submitted_at", header: "Submitted", render: (row) => row.submitted_at ? formatDateTime(row.submitted_at) : "—" },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

  const records = data?.data ?? [];
  const canReview = detail && ["submitted", "info_requested"].includes(detail.status);
  const canSuspend = detail?.status === "approved";

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Owner Applications" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Owner Applications" description="Review individual vehicle owners applying to list on the marketplace." />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectInput
            label="Status"
            className="w-48"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={STATUS_OPTIONS}
          />
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-sm font-medium">Search</label>
            <Input placeholder="Search by name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <DataTable columns={columns} data={records} loading={isLoading} />

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {data.current_page} of {data.last_page} — {data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PageWrapper>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.full_name}
              {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Email</p><p>{detail.user?.email}</p></div>
                <div><p className="text-muted-foreground">NIC Number</p><p>{detail.nic_number}</p></div>
                <div><p className="text-muted-foreground">Contact Phone</p><p>{detail.contact_phone}</p></div>
                <div><p className="text-muted-foreground">Date of Birth</p><p>{detail.date_of_birth ? String(detail.date_of_birth).slice(0, 10) : "—"}</p></div>
                <div className="col-span-2"><p className="text-muted-foreground">Address</p><p>{[detail.address_line_1, detail.city, detail.district].filter(Boolean).join(", ") || "—"}</p></div>
              </div>

              {detail.rejection_reason && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">Rejected: {detail.rejection_reason}</p>
              )}
              {detail.info_requested_note && (
                <p className="rounded-md bg-amber-500/10 p-2 text-sm text-amber-700">Info requested: {detail.info_requested_note}</p>
              )}
              {detail.suspension_reason && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">Suspended: {detail.suspension_reason}</p>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
                <ul className="space-y-2">
                  {(detail.verifications ?? []).map((v) => (
                    <li key={v.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{v.document_type.replace(/_/g, " ")}</span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(v.id, v.attachment?.file_name)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </li>
                  ))}
                  {!(detail.verifications ?? []).length && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
                </ul>
              </div>

              {(canReview || canSuspend) && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {canReview && (
                    <>
                      <Button variant="outline" onClick={() => setReasonAction("request-info")}>Request Info</Button>
                      <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>Reject</Button>
                      <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
                    </>
                  )}
                  {canSuspend && (
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("suspend")}>Suspend</Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={reasonAction === "reject"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Reject Application"
        description="This will be shown to the applicant."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "request-info"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Request More Information"
        description="Tell the applicant what's missing or needs correction."
        confirmText="Request Info"
        loading={requestInfo.isPending}
        onConfirm={(reason) => requestInfo.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "suspend"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Suspend Owner"
        description="The owner's shop will be unaffected unless you also suspend it separately."
        confirmText="Suspend"
        loading={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
    </div>
  );
}
