"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformShopVerificationService } from "@/services/platformShopVerificationService";
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

const VERIFICATION_OPTIONS = [
  { value: "", label: "All verification states" },
  { value: "pending", label: "Pending" },
  { value: "unverified", label: "Unverified" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default function PlatformShopsPage() {
  const qc = useQueryClient();
  const [verificationStatus, setVerificationStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'suspend'

  const { data, isLoading } = useQuery({
    queryKey: ["platform-shops", verificationStatus, search, page],
    queryFn: () => platformShopVerificationService.getAll({ verification_status: verificationStatus || undefined, search: search || undefined, page }).then((r) => r.data.record),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["platform-shop", selected?.id],
    queryFn: () => platformShopVerificationService.getOne(selected.id).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-shops"] });
    qc.invalidateQueries({ queryKey: ["platform-shop", selected?.id] });
  };

  const verify = useMutation({
    mutationFn: () => platformShopVerificationService.verify(selected.id),
    onSuccess: () => { invalidate(); toast.success("Shop verified and published"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to verify"),
  });

  const reject = useMutation({
    mutationFn: (reason) => platformShopVerificationService.reject(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Shop rejected"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reject"),
  });

  const suspend = useMutation({
    mutationFn: (reason) => platformShopVerificationService.suspend(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Shop suspended"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to suspend"),
  });

  const activate = useMutation({
    mutationFn: () => platformShopVerificationService.activate(selected.id),
    onSuccess: () => { invalidate(); toast.success("Shop reactivated"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to activate"),
  });

  const handleDownload = async (verificationId, filename) => {
    try {
      const res = await platformShopVerificationService.downloadDocument(verificationId);
      downloadBlob(res.data, filename);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const columns = [
    {
      key: "name", header: "Shop",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.owner?.email}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "verification_status", header: "Verification", render: (row) => <StatusBadge status={row.verification_status} /> },
    { key: "created_at", header: "Registered", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

  const records = data?.data ?? [];
  const canVerify = detail && ["unverified", "pending"].includes(detail.verification_status);
  const canSuspend = detail?.status === "active";
  const canActivate = detail?.status === "suspended" && detail?.verification_status === "verified";

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Shop Verification" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader title="Shop Verification" description="Review and verify business rental shops before they go live." />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectInput
            label="Verification"
            className="w-56"
            value={verificationStatus}
            onChange={(v) => { setVerificationStatus(v); setPage(1); }}
            options={VERIFICATION_OPTIONS}
          />
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-sm font-medium">Search</label>
            <Input placeholder="Search by shop name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
              {detail?.name}
              {detail && <StatusBadge status={detail.status} />}
              {detail && <StatusBadge status={detail.verification_status} />}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Owner</p><p>{detail.owner?.name} ({detail.owner?.email})</p></div>
                <div><p className="text-muted-foreground">Phone</p><p>{detail.phone ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Business Reg. No.</p><p>{detail.business_registration_no ?? "—"}</p></div>
                <div className="col-span-2"><p className="text-muted-foreground">Address</p><p>{[detail.address_line_1, detail.city, detail.district].filter(Boolean).join(", ") || "—"}</p></div>
              </div>

              {detail.suspended_reason && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{detail.suspended_reason}</p>
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

              {(canVerify || canSuspend || canActivate) && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {canVerify && (
                    <>
                      <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>Reject</Button>
                      <Button onClick={() => verify.mutate()} disabled={verify.isPending}>Verify & Publish</Button>
                    </>
                  )}
                  {canSuspend && (
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("suspend")}>Suspend</Button>
                  )}
                  {canActivate && (
                    <Button onClick={() => activate.mutate()} disabled={activate.isPending}>Reactivate</Button>
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
        title="Reject Shop"
        description="This will be shown to the shop owner."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "suspend"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Suspend Shop"
        description="The shop will be unpublished immediately."
        confirmText="Suspend"
        loading={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
    </div>
  );
}
