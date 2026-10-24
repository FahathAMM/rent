"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformPayoutService } from "@/services/platformPayoutService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { ChevronLeft, ChevronRight, Home, Loader2, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function PlatformPayoutsPage() {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [status, setStatus] = useState("pending_approval");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // 'failed'
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [evidenceErrors, setEvidenceErrors] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-payouts", status, page],
    queryFn: () => platformPayoutService.getAll({ status: status || undefined, page }).then((r) => r.data.record),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["platform-payout", selected?.id],
    queryFn: () => platformPayoutService.getOne(selected.id).then((r) => r.data.data),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-payouts"] });
    qc.invalidateQueries({ queryKey: ["platform-payout", selected?.id] });
  };

  const build = useMutation({
    mutationFn: () => platformPayoutService.build(),
    onSuccess: (res) => { invalidate(); toast.success(res.data.message); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to build payouts"),
  });

  const approve = useMutation({
    mutationFn: () => platformPayoutService.approve(selected.id),
    onSuccess: () => { invalidate(); toast.success("Payout approved"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to approve"),
  });

  const markProcessing = useMutation({
    mutationFn: () => platformPayoutService.markProcessing(selected.id),
    onSuccess: () => { invalidate(); toast.success("Payout marked processing"); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const markPaid = useMutation({
    mutationFn: (evidence) => platformPayoutService.markPaid(selected.id, evidence),
    onSuccess: () => { invalidate(); toast.success("Payout marked paid"); setEvidenceOpen(false); setSelected(null); },
    onError: (err) => setEvidenceErrors(err.response?.data?.errors ?? {}),
  });

  const markFailed = useMutation({
    mutationFn: (reason) => platformPayoutService.markFailed(selected.id, reason),
    onSuccess: () => { invalidate(); toast.success("Payout marked failed — items released back to the pool"); setReasonAction(null); setSelected(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const columns = [
    {
      key: "payout_reference", header: "Payout",
      render: (row) => (
        <div>
          <p className="font-medium">{row.payout_reference}</p>
          <p className="text-[11px] text-muted-foreground">{row.shop?.name}</p>
        </div>
      ),
    },
    { key: "period", header: "Period", render: (row) => `${row.period_start} → ${row.period_end}` },
    { key: "booking_count", header: "Bookings" },
    { key: "net_amount", header: "Net Amount", render: (row) => format(row.net_amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}>Review</Button>,
    },
  ];

  const records = data?.data ?? [];
  const canApprove = detail?.status === "pending_approval";
  const canMarkProcessing = detail?.status === "approved";
  const canMarkPaid = detail && ["approved", "processing"].includes(detail.status);
  const canMarkFailed = canMarkPaid;

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Payouts" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Owner Payouts"
          description="Manual settlement batches — see app-doc/marketplace/04-lifecycles.md 'Payout cycle'."
          action={
            <Button onClick={() => build.mutate()} disabled={build.isPending} className="gap-1.5">
              {build.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Build Payouts Now
            </Button>
          }
        />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectInput label="Status" className="w-56" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
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

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.payout_reference}
              {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Shop</p><p>{detail.shop?.name}</p></div>
                <div><p className="text-muted-foreground">Owner</p><p>{detail.shop?.owner?.name} ({detail.shop?.owner?.email})</p></div>
                <div><p className="text-muted-foreground">Period</p><p>{detail.period_start} → {detail.period_end}</p></div>
                <div><p className="text-muted-foreground">Bank</p><p>{detail.bank_detail ? `${detail.bank_detail.bank_name} — ****${detail.bank_detail.account_number_last4}` : "Not on file"}</p></div>
              </div>

              <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross rental</span><span>{format(detail.gross_rental_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span>-{format(detail.commission_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Processing fee</span><span>-{format(detail.processing_fee_amount)}</span></div>
                {Number(detail.adjustments_amount) !== 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Adjustments</span><span>{format(detail.adjustments_amount)}</span></div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Net amount</span><span>{format(detail.net_amount)}</span></div>
              </div>

              {detail.failure_reason && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{detail.failure_reason}</p>
              )}
              {detail.evidence_reference && (
                <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-700">Settled via: {detail.evidence_reference}</p>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bookings ({detail.items?.length ?? 0})</p>
                <ul className="space-y-1 text-sm">
                  {(detail.items ?? []).map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
                      <span>{item.booking?.booking_reference}</span>
                      <span>{format(item.net_amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {(canApprove || canMarkProcessing || canMarkPaid || canMarkFailed) && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {canMarkFailed && (
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setReasonAction("failed")}>Mark Failed</Button>
                  )}
                  {canApprove && <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>}
                  {canMarkProcessing && <Button onClick={() => markProcessing.mutate()} disabled={markProcessing.isPending}>Mark Processing</Button>}
                  {canMarkPaid && <Button onClick={() => { setEvidenceErrors({}); setEvidenceRef(""); setEvidenceOpen(true); }}>Mark Paid</Button>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payout Paid</DialogTitle>
            <DialogDescription>Settlement evidence is required — never mark a payout complete without it.</DialogDescription>
          </DialogHeader>
          <ValidationError errors={evidenceErrors} />
          <TextInput label="Bank Transaction Reference" required value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="e.g. BANKREF-20261024-001" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceOpen(false)}>Cancel</Button>
            <Button onClick={() => markPaid.mutate({ evidence_reference: evidenceRef })} disabled={markPaid.isPending || !evidenceRef}>
              {markPaid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={reasonAction === "failed"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Mark Payout Failed"
        description="Its booking financials are released back to the unsettled pool for the next cycle."
        confirmText="Mark Failed"
        loading={markFailed.isPending}
        onConfirm={(reason) => markFailed.mutate(reason)}
      />
    </div>
  );
}
